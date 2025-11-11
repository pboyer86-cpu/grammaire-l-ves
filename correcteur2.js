/**
 * Fichier Correcteur 2.0 : Architecture modulaire pour une maintenance simplifiée.
 * Sépare strictement : Structuration (Étape 1 & 2), Validation Interne (Étape 3), Validation Globale (Étape 4).
 */
var Correcteur2 = {

    // =========================================================
    //                    CONSTANTES & RÈGLES GLOBALES
    // =========================================================
    
    // Définit les patrons de structure de phrase valides (Séquences de Blocs)
    REGLES_STRUCTURE: [
        // GN + Verbe (Ex: Le chien dort)
        ["GN", "verbe"],
        // GPron + Verbe (Ex: Il dort)
        ["GPron", "verbe"],
        // GN + Verbe + GN (Ex: Le chien mange l'os)
        ["GN", "verbe", "GN"],
        // GPron + Verbe + GN (Ex: Il mange l'os)
        ["GPron", "verbe", "GN"],
        // GN + Verbe + GPrep (Ex: Le chien joue dans le jardin)
        // Note: Le GPrep devrait être fusionné dans GN/GV lors de combinerBlocs pour les cas simples, mais on le laisse ici pour la structure explicite.
        ["GN", "verbe", "GP"],
        // GPron + Verbe + GP (Ex: Il joue dans le jardin)
        ["GPron", "verbe", "GP"],
        // GN + Verbe + GAdj (Ex: Le chien semble heureux)
        ["GN", "verbe", "GAdj"],
        // GPron + Verbe + GAdj (Ex: Il semble heureux)
        ["GPron", "verbe", "GAdj"],
        // Nouveaux : GN/GPron + Verbe + GInf (Ex: Il aime manger / Je veux dormir)
        ["GN", "verbe", "GInf"],
        ["GPron", "verbe", "GInf"],
        // Nouveaux : GN/GPron + Verbe + GAdv (Ex: Le chien court vite / Il court vite)
        ["GN", "verbe", "GAdv"],
        ["GPron", "verbe", "GAdv"],
        // Nouveaux : GAdv + Verbe + Sujet Inversé (Ex: Soudain arrive le train / Ainsi soit-il)
        ["GAdv", "verbe", "GN"],
        ["GAdv", "verbe", "GPron"],
        // Nouveaux : GInf en position de sujet (Ex: Manger est bon / Partir loin demande du courage)
        ["GInf", "verbe"],
        ["GInf", "verbe", "GN"],
        ["GInf", "verbe", "GAdj"],
        ["GInf", "verbe", "GP"],
        // (Ajoutez ici toutes les structures simples valides)
    ],

    // Liste des adverbes qui peuvent modifier un autre adverbe (adverbes de degré)
    ADVERBES_DEGRE: ['très', 'plus', 'moins', 'assez', 'trop', 'si', 'bien'],

    // Ligne 46 : INSERTION DU BLOC ETATS_FSM
    ETATS_FSM: {
        ATTENTE_GROUPE: 'ATTENTE_GROUPE', // État par défaut après un bloc terminé
        DANS_GN: 'DANS_GN',               // Construction d'un Groupe Nominal
        DANS_GADV: 'DANS_GADV',           // Construction d'un Groupe Adverbial (souvent temporaire)
        DANS_GPREP: 'DANS_GPREP',         // Construction d'un Groupe Prépositionnel
        APRES_NOYAU_SIMPLE: 'APRES_NOYAU_SIMPLE' // Après un verbe, pronom, ou infinitif (fin de bloc simple)
    },

    
    // =========================================================
    // =========================================================
    //                    FLUX PRINCIPAL D'ANALYSE
    // =========================================================
    
    analyserPhrase: function(words) {
        let erreurs = [];

        // Étape 0 : Validation de base (ex: élision)
        const elisionError = this.validerElision(words);
        if (elisionError) {
            erreurs.push(elisionError);
        }

        // Étape 1 : Créer les blocs syntaxiques (GN, Verbe, etc.) - PUREMENT STRUCTURAL
        let blocs = this.creerBlocs(words);

        // Étape 2 : Combiner les blocs pour gérer les expansions (ex: complément du nom) - PUREMENT STRUCTURAL
        blocs = this.combinerBlocs(blocs);

        // --- DÉBUT DES VÉRIFICATIONS GRAMMATICALES SÉPARÉES ---
        
        // Étape 3a : Valider la composition interne des blocs (GN doit avoir un nom, etc.)
        erreurs.push(...this.validerCompositionBlocs(blocs));
        
        // Étape 3b : Valider les accords à l'intérieur des blocs (Genre/Nombre/Temps)
        erreurs.push(...this.validerAccordsInternes(blocs));
        
        // Étape 4 : Valider la structure globale de la phrase (Ordre des blocs)
        const structureValidation = this.validerStructureGlobale(blocs);
        if (!structureValidation.valide) {
            // On ajoute l'erreur de structure seulement si aucune autre erreur plus spécifique n'a été trouvée
            if (erreurs.length === 0) {
                erreurs.push(structureValidation.message);
            }
        }

        // Étape 5 : Identification des fonctions et validation des accords globaux (Sujet-Verbe)
        const arbre = this.identifierFonctions(blocs);
        if (structureValidation.valide) { // On ne valide les accords globaux que si la structure est bonne
            erreurs.push(...this.validerAccordsGlobaux(arbre));
        }

        // Résultat final
        if (erreurs.length > 0) {
            return { valide: false, message: erreurs.join('\n'), arbre: arbre };
        } else {
            return { valide: true, message: "La phrase est grammaticalement correcte.", arbre: arbre };
        }
    },

    // =========================================================
    //             LOGIQUE DE STRUCTURATION (Étapes 1 & 2)
    // =========================================================

/**
     * ÉTAPE 1 : Refonte avec un Automate Fini (FSM) pour la segmentation.
     * Parcourt les mots et les segmente en blocs syntaxiques (GN, GAdv, verbe, etc.).
     * Cette logique remplace les if/else if séquentiels par des règles de transition.
     */
    creerBlocs: function(words) {
        const blocsFinaux = [];
        let currentState = this.ETATS_FSM.ATTENTE_GROUPE;
        let currentBlockBuffer = []; // Mots du bloc en cours
        let blockType = null;        // Type du bloc en cours (GN, GAdv, etc.)

        // Fonction utilitaire pour finaliser le bloc en cours et préparer le suivant.
        const viderBufferEtChangerEtat = (nouveauType, nouvelEtat, motActuel = null) => {
            // 1. Finalisation du bloc précédent
            if (currentBlockBuffer.length > 0) {
                blocsFinaux.push({
                    type: blockType,
                    mots: currentBlockBuffer
                });
            }

            // 2. Réinitialisation
            currentBlockBuffer = [];
            blockType = null;
            
            // 3. Début du nouveau bloc
            if (nouveauType && motActuel) {
                blockType = nouveauType;
                currentBlockBuffer.push(motActuel);
            }
            
            // 4. Mise à jour de l'état
            currentState = nouvelEtat;
        };

        // Fonction utilitaire pour gérer la rupture d'un bloc et le démarrage d'un nouveau.
        const rompreBlocActuelEtDemarrerNouveau = (word, isInfinitif, isVerbeSimple, isAdverb) => {
            const type = isInfinitif ? 'GInf' : word.type;
            // Les blocs simples (verbe, pronom, adverbe, infinitif) mènent à APRES_NOYAU_SIMPLE.
            const nextState = (isVerbeSimple || isInfinitif || word.type === 'pronom' || isAdverb) ? this.ETATS_FSM.APRES_NOYAU_SIMPLE : this.ETATS_FSM.ATTENTE_GROUPE;
            viderBufferEtChangerEtat(type, nextState, word);
        };

        // --- Cœur de la FSM : boucle de transition sur chaque mot ---
        words.forEach((word) => {
            const wordType = word.type;
            const isPreposition = wordType === 'preposition';
            const isDeterminant = wordType === 'determinant';
            const isGNConstituent = isDeterminant || wordType === 'nom' || wordType === 'adjectif';
            const isVerbeSimple = wordType === 'verbe' && word.mode !== 'infinitif';
            const isInfinitif = wordType === 'verbe' && word.mode === 'infinitif';
            const isAdverb = wordType === 'adverbe';
            const isAdjective = wordType === 'adjectif';

            switch (currentState) {

                // =========================================================
                // ÉTAT 1 : ATTENTE_GROUPE (Début de phrase ou après bloc simple)
                // =========================================================
                case this.ETATS_FSM.ATTENTE_GROUPE:
                case this.ETATS_FSM.APRES_NOYAU_SIMPLE: 
                    if (isGNConstituent) {
                        // Début d'un GN
                        viderBufferEtChangerEtat('GN', this.ETATS_FSM.DANS_GN, word);
                    } else if (isPreposition) {
                        // Début d'un GP
                        viderBufferEtChangerEtat('GP', this.ETATS_FSM.DANS_GPREP, word);
                    } else if (wordType === 'pronom') {
                        // GPron : bloc simple, retour à l'état simple
                        viderBufferEtChangerEtat('GPron', this.ETATS_FSM.APRES_NOYAU_SIMPLE, word);
                    } else if (isVerbeSimple || isInfinitif) {
                        // Verbe/GInf : bloc simple, retour à l'état simple
                        const type = isInfinitif ? 'GInf' : 'verbe';
                        viderBufferEtChangerEtat(type, this.ETATS_FSM.APRES_NOYAU_SIMPLE, word);
                    } else if (isAdverb) {
                        // Début d'un GAdv
                        viderBufferEtChangerEtat('GAdv', this.ETATS_FSM.DANS_GADV, word);
                    } else {
                        // Mots non analysés (ponctuation, etc.)
                        viderBufferEtChangerEtat(wordType, this.ETATS_FSM.ATTENTE_GROUPE, word);
                    }
                    break;

                // =========================================================
                // ÉTAT 2 : DANS_GN (Construction d'un Groupe Nominal)
                // =========================================================
                case this.ETATS_FSM.DANS_GN:
                    // Règle 1 : Continuer le GN avec Nom ou Adj
                    if (wordType === 'nom' || isAdjective) { 
                        currentBlockBuffer.push(word);
                        // L'état reste DANS_GN
                    }
                    // Règle 2 : Rupture par un nouveau Déterminant (ex: "le chat le chien")
                    else if (isDeterminant) {
                        viderBufferEtChangerEtat('GN', this.ETATS_FSM.DANS_GN, word);
                    }
                    // Règle 3 : Rupture par une Préposition (fin du GN et début d'un GP)
                    else if (isPreposition) {
                        viderBufferEtChangerEtat('GP', this.ETATS_FSM.DANS_GPREP, word);
                    }
                    // Règle 4 : Rupture par un Verbe/Pronom/Adverbe/GInf
                    else {
                        rompreBlocActuelEtDemarrerNouveau(word, isInfinitif, isVerbeSimple, isAdverb);
                    }
                    break;

                // =========================================================
                // ÉTAT 3 : DANS_GADV (Construction d'un Groupe Adverbial)
                // =========================================================
                case this.ETATS_FSM.DANS_GADV:
                    // Règle 1 : Continuer le GAdv avec un autre adverbe (ex: très lentement)
                    if (isAdverb) {
                        currentBlockBuffer.push(word);
                        // L'état reste DANS_GADV
                    }
                    // Règle 2 : Le GAdv est suivi d'un adjectif -> Fusion et transformation en GAdj
                    else if (isAdjective) {
                        // On ne vide PAS le buffer, on le modifie
                        currentBlockBuffer.push(word);
                        blockType = 'GAdj'; 
                        currentState = this.ETATS_FSM.APRES_NOYAU_SIMPLE; // Le GAdj est considéré comme un bloc simple
                    }
                    // Règle 3 : Rupture par tout le reste (GN, Verbe, etc.)
                    else {
                        rompreBlocActuelEtDemarrerNouveau(word, isInfinitif, isVerbeSimple, isAdverb);
                    }
                    break;

                // =========================================================
                // ÉTAT 4 : DANS_GPREP (Construction du régime du Groupe Prépositionnel)
                // =========================================================
                case this.ETATS_FSM.DANS_GPREP:
                    // Règle 1 : Tout mot non prépositionnel fait partie du régime de ce GP.
                    if (!isPreposition) {
                        currentBlockBuffer.push(word);
                    } 
                    // Règle 2 : Rupture par une nouvelle Préposition
                    else {
                        viderBufferEtChangerEtat('GP', this.ETATS_FSM.DANS_GPREP, word);
                    }
                    break;
            }
        });

        // Vider le buffer une dernière fois à la fin de la phrase
        viderBufferEtChangerEtat(null, this.ETATS_FSM.ATTENTE_GROUPE);

        return blocsFinaux;
    },
    /**
     * ÉTAPE 2 : Combine les blocs adjacents pour former des groupes syntaxiques étendus.
     * Exemples : [GN, GP] devient un seul GN (complément du nom), [GN, GAdj] devient un seul GN (épithète).
     */
    combinerBlocs: function(blocs) {
        const combinedBlocs = [];
        let i = 0;
        while (i < blocs.length) {
          let currentBlock = blocs[i];

          // Si on a un GN suivi d'un GP (complément du nom)
          if (i + 1 < blocs.length && currentBlock.type === 'GN' && blocs[i + 1].type === 'GP') {
            // On fusionne le GP dans le GN pour une meilleure analyse interne
            currentBlock.mots.push(...blocs[i + 1].mots);
            i++; 
          }
          // Nouveau : Si on a un GInf suivi d'un GN ou GP (complément de l'infinitif)
          else if (i + 1 < blocs.length && currentBlock.type === 'GInf' && (blocs[i + 1].type === 'GN' || blocs[i + 1].type === 'GP')) {
            // On fusionne le GN/GP dans le GInf
            currentBlock.mots.push(...blocs[i + 1].mots);
            i++; 
          }
          // Nouveau : Si on a un GN suivi d'un GAdj (adjectif épithète postposé)
          else if (i + 1 < blocs.length && currentBlock.type === 'GN' && blocs[i + 1].type === 'GAdj') {
            // On fusionne le GAdj dans le GN
            currentBlock.mots.push(...blocs[i + 1].mots);
            i++;
          }

          combinedBlocs.push(currentBlock);
          i++;
        }
        return combinedBlocs;
    },
    
    // =========================================================
    //             VALIDATION INTERNE (Étapes 3a & 3b)
    // =========================================================
    
    /**
     * ÉTAPE 3a : Valide la composition interne des blocs.
     * Vérifie si les blocs sont structurellement complets (ex: un GN doit avoir un nom).
     */
    validerCompositionBlocs: function(blocs) {
        const erreurs = [];

        blocs.forEach(gn => {
             if (gn.type !== 'GN') return; // Se concentrer sur les GN

            const aUnNomCommun = gn.mots.some(m => m.type === 'nom' && m.subtype === 'commun');
            const aUnNomPropre = gn.mots.some(m => m.type === 'nom' && m.subtype === 'propre');
            const aUnDeterminant = gn.mots.some(m => m.type === 'determinant');
            const estDeterminantSeul = gn.mots.length === 1 && gn.mots[0].type === 'determinant';
            const gnTexte = gn.mots.map(m => m.text).join(' ');

            // Règle 1 : Un nom commun dans un GN doit être accompagné d'un déterminant (sauf nom propre).
            if (aUnNomCommun && !aUnDeterminant && !aUnNomPropre) {
                erreurs.push(`[GN-Comp] Le nom commun "${gn.mots.find(m => m.subtype === 'commun').text}" doit être accompagné d'un déterminant (ex: "les oiseaux").`);
            }

            // Règle 2 : Un GN ne peut pas être juste un déterminant.
            if (estDeterminantSeul) {
                erreurs.push(`[GN-Comp] Le déterminant "${gnTexte}" est incomplet. Il doit être suivi d'un nom.`);
            }

            // Règle 3 : Un GN doit contenir un nom.
            if (!aUnNomCommun && !aUnNomPropre) {
                 erreurs.push(`[GN-Comp] Le groupe nominal "${gnTexte}" est incomplet. Il manque probablement un nom.`);
            }

            // Règle 4 : Ordre DET-NOM (Transféré de l'ancien `validerArbre`)
            const indexDeterminant = gn.mots.findIndex(m => m.type === 'determinant');
            const indexNom = gn.mots.findIndex(m => m.type === 'nom');
            if (indexDeterminant !== -1 && indexNom !== -1 && indexDeterminant > indexNom) {
                erreurs.push(`[GN-Ordre] Dans le groupe nominal "${gnTexte}", le déterminant doit être placé avant le nom.`);
            }
            
            // Règle 5 : Validation de la structure du Complément du Nom (Transféré de l'ancien `validerArbre`)
            const indexPreposition = gn.mots.findIndex(m => ['à', 'de', 'en'].includes(m.text));
            if (indexPreposition > 0) {
              const motJusteAvant = gn.mots[indexPreposition - 1];
              const motJusteApres = gn.mots[indexPreposition + 1];

              if (motJusteAvant && motJusteAvant.type !== 'nom') {
                erreurs.push(`[GN-C.N] La préposition "${gn.mots[indexPreposition].text}" doit compléter un nom, pas un "${motJusteAvant.type}".`);
              }
              const typesAutorisesApresPreposition = ['nom', 'determinant', 'pronom', 'verbe', 'adverbe'];
              if (!motJusteApres || !typesAutorisesApresPreposition.includes(motJusteApres.type)) {
                erreurs.push(`[GN-C.N] La préposition "${gn.mots[indexPreposition].text}" doit être suivie d'un groupe nominal, d'un pronom, d'un verbe à l'infinitif ou d'un adverbe.`);
              }
            }
        });

        return erreurs;
    },

    /**
     * ÉTAPE 3b : Valide les accords à l'intérieur de chaque bloc.
     * Vérifie les accords en genre et nombre (ex: déterminant-nom, nom-adjectif).
     */
    validerAccordsInternes: function(blocs) {
        const erreurs = [];
        for (const bloc of blocs) {
          if (bloc.type === 'GN' && bloc.mots.length > 1) {
            const determinant = bloc.mots.find(m => m.type === 'determinant');
            const nom = bloc.mots.find(m => m.type === 'nom');

            if (determinant && nom) {
              // Règle d'accord en NOMBRE
              if (determinant.number && nom.number && determinant.number !== nom.number) {
                erreurs.push(`[Accord-GN] Le déterminant "${determinant.text}" (${determinant.number}) ne s'accorde pas en nombre avec le nom "${nom.text}" (${nom.number}).`);
              }

              // Règle d'accord en GENRE (uniquement si le nombre est singulier)
              if (determinant.number === 'singulier') {
                const detGenre = determinant.gender;
                const nomGenre = nom.gender;
                const isDetFlexible = (detGenre === 'mixte' || detGenre === 'elision');
                if (detGenre !== nomGenre && !isDetFlexible && nomGenre !== 'epicene') {
                  erreurs.push(`[Accord-GN] Le déterminant "${determinant.text}" (${detGenre}) ne s'accorde pas avec le nom "${nom.text}" (${nomGenre}).`);
                }
              }
            }

            // Règle d'accord pour les ADJECTIFS ÉPITHÈTES dans le GN
            const adjectifs = bloc.mots.filter(m => m.type === 'adjectif');
            if (nom && adjectifs.length > 0) {
                adjectifs.forEach(adj => {
                    if (adj.number && nom.number && adj.number !== nom.number) {
                        erreurs.push(`[Accord-GN] L'adjectif "${adj.text}" (${adj.number}) ne s'accorde pas en nombre avec le nom "${nom.text}" (${nom.number}).`);
                    }
                    if (adj.gender && nom.gender && adj.gender !== nom.gender && nom.gender !== 'epicene') {
                        erreurs.push(`[Accord-GN] L'adjectif "${adj.text}" (${adj.gender}) ne s'accorde pas en genre avec le nom "${nom.text}" (${nom.gender}).`);
                    }
                });
            }
          }
        }
        return erreurs;
    },

    /**
     * ÉTAPE 5 : Valide les accords entre les différents blocs de la phrase.
     * @param {Object} arbre - L'arbre syntaxique avec les fonctions identifiées.
     * @returns {Array} - Une liste d'erreurs d'accord.
     */
    validerAccordsGlobaux: function(arbre) {
        const erreurs = [];

        // Règle 1 : Accord Sujet-Verbe
        if (arbre.sujet && arbre.verbe) {
            const sujetPrincipal = arbre.sujet.mots.find(m => m.type === 'nom' || m.type === 'pronom');
            const verbeMot = arbre.verbe.mots[0];

            // Si le sujet est un groupe infinitif, le verbe est toujours à la 3ème personne du singulier.
            if (arbre.sujet.type === 'GInf') {
                if (verbeMot.person !== 'il') {
                    erreurs.push(`[Accord S-V] Quand le sujet est un infinitif ("${arbre.sujet.mots[0].text}..."), le verbe doit être à la 3ème personne du singulier (comme avec "il").`);
                }
            } 
            // Cas général pour les GN et GPron
            else if (sujetPrincipal && verbeMot.person) {
                let personneSujet;
                if (sujetPrincipal.type === 'pronom') {
                    personneSujet = sujetPrincipal.person;
                } else { // C'est un nom
                    personneSujet = (sujetPrincipal.number === 'pluriel') ? 'ils' : 'il';
                }
                
                if (personneSujet !== verbeMot.person) {
                    erreurs.push(`[Accord S-V] Le sujet "${sujetPrincipal.text}" (${personneSujet}) ne s'accorde pas avec le verbe "${verbeMot.text}" (${verbeMot.person}).`);
                }
            }
        }

        return erreurs;
    },

    // =========================================================
    //             VALIDATION GLOBALE (Étape 4)
    // =========================================================

    /**
     * ÉTAPE 4 : Valide la structure globale de la phrase en comparant la séquence de blocs
     * à une liste de patrons de phrases valides (`REGLES_STRUCTURE`).
     */
    validerStructureGlobale: function(blocs) {
        const erreurs = [];
        
        // 1. Règle : Interdire le verbe en première position (transféré de l'ancien `validerArbre`)
        if (blocs && blocs.length > 0 && blocs[0].type === 'verbe') {
          return { valide: false, message: "❌ Structure : Une phrase déclarative simple ne peut pas commencer par un verbe conjugué." }; 
        }

        // 2. Règle : Interdire la séquence "Pronom Sujet" + "Groupe Nominal" (transféré de l'ancien `validerArbre`)
        for (let i = 0; i < blocs.length - 1; i++) {
          const blocActuel = blocs[i];
          const blocSuivant = blocs[i+1];

          if (blocActuel.type === 'GN' && blocActuel.mots.length === 1 && blocActuel.mots[0].subtype === 'personnel-sujet' && blocSuivant.type === 'GN') {
            const erreur = `❌ Structure : Un pronom sujet comme "${blocActuel.mots[0].text}" ne peut pas être directement suivi d'un autre groupe nominal comme "${blocSuivant.mots.map(m => m.text).join(' ')}". Il manque probablement un verbe.`;
             return { valide: false, message: erreur };
          }
        }
        
        // 3. Règle : Comparer la séquence de types avec les patrons définis (le cœur de l'Étape 4)
        const sequenceTypes = blocs.map(bloc => bloc.type); 
        const sequencePhrase = sequenceTypes.join("-");
        
        let estValide = false;
        for (const patron of this.REGLES_STRUCTURE) {
            const patronRecherche = patron.join("-");
            if (sequencePhrase === patronRecherche) {
                estValide = true;
                break; 
            }
        }
        
        if (estValide) {
            return { valide: true, message: "" };
        } else {
            const explication = blocs.map(b => `${b.type}(${b.mots.map(m => m.text).join(' ')})`).join(' ');
            return { 
                valide: false, 
                message: `❌ Structure : La séquence de blocs "${sequencePhrase}" n'est pas une structure de phrase de base valide. Détail : ${explication}` 
            };
        }
    },

    // =========================================================
    //             FONCTIONS AUXILIAIRES (Transférées)
    // =========================================================

    /**
     * Vérifie le bon usage des formes élidées (ex: "l'") et non élidées (ex: "le").
     */
    validerElision: function(words) {
      const VOWELS = ['a', 'e', 'i', 'o', 'u', 'y', 'é', 'è', 'ê', 'à', 'â', 'î', 'ô', 'û', 'h'];
      const WORDS_THAT_ELIDE = ['je', 'ne', 'me', 'te', 'se', 'le', 'de', 'que'];

      for (let i = 0; i < words.length - 1; i++) {
        const currentWord = words[i];
        const nextWord = words[i + 1];
        const nextWordFirstChar = nextWord.text.charAt(0).toLowerCase();
        const nextWordStartsWithVowel = VOWELS.includes(nextWordFirstChar);

        // Règle 1 : Une forme élidée (j', l'...) doit être suivie d'une voyelle.
        if (currentWord.gender === 'elision') {
          if (!nextWordStartsWithVowel) {
            return `Erreur d'élision : La forme élidée "${currentWord.text}" doit être utilisée devant un mot commençant par une voyelle ou un 'h' muet.`;
          }
        }

        // Règle 2 : Une forme non élidée (je, le...) ne doit PAS être suivie d'une voyelle.
        if (WORDS_THAT_ELIDE.includes(currentWord.text.toLowerCase())) {
          if (nextWordStartsWithVowel) {
            return `Erreur d'élision : Le mot "${currentWord.text}" doit être élidé (ex: "l'") devant un mot commençant par une voyelle comme "${nextWord.text}".`;
          }
        }
      }
      return null;
    },

    /**
     * Identifie les fonctions grammaticales principales (Sujet, Verbe, COD, etc.)
     * à partir de la séquence de blocs validée. Le résultat est utilisé pour l'affichage pédagogique.
     */
    identifierFonctions: function(blocs) {
        // La logique complète du parser est transférée ici.
        const arbre = { sujet: null, verbe: null, cod: null, attribut: null, autres: [] };
        const indexVerbe = blocs.findIndex(b => b.type === 'verbe');

        if (indexVerbe !== -1) {
            arbre.verbe = blocs[indexVerbe];
            const avantVerbe = blocs.slice(0, indexVerbe);
            const apresVerbe = blocs.slice(indexVerbe + 1);

            const sujetTrouve = avantVerbe.find(b => b.type === 'GN' || b.type === 'GPron' || b.type === 'GInf');
            arbre.sujet = sujetTrouve || null;

            if (!arbre.sujet) {
                arbre.sujet = apresVerbe.find(b => b.type === 'GN' || b.type === 'GPron' || b.type === 'GInf') || null;
            }

            if (arbre.verbe.mots[0].subtype === 'etat') {
                const attributTrouve = apresVerbe.find(b => (b.type === 'GN' && b.mots.some(m => m.type === 'adjectif')) || b.type === 'GAdj');
                arbre.attribut = attributTrouve || null;
            } else {
                const codTrouve = apresVerbe.find(b => (b.type === 'GN' || b.type === 'GInf') && b !== arbre.sujet && b !== arbre.attribut);
                arbre.cod = codTrouve || null;
            }

            arbre.autres = [
                ...avantVerbe.filter(b => b !== arbre.sujet),
                ...apresVerbe.filter(b => b !== arbre.cod && b !== arbre.attribut)
            ].filter(b => b.type !== 'verbe' && b !== arbre.sujet && b !== arbre.cod && b !== arbre.attribut);

        } else {
            arbre.autres = blocs;
        }
        return arbre;
    },

    /**
     * Analyse l'arbre syntaxique pour identifier les fonctions détaillées à l'intérieur des groupes
     * (ex: Épithète, Complément du Nom). Cette fonction est purement descriptive pour l'affichage.
     */
    analyserFonctionsDetaillees: function(arbre) {
        // La logique est purement descriptive et ne modifie pas l'état de la validation.
        // ... (Contenu de la fonction originale)
        const fonctions = [];

        // Fonctions principales
        if (arbre.sujet) fonctions.push({ label: 'Sujet', mots: arbre.sujet.mots });
        if (arbre.verbe) fonctions.push({ label: 'Verbe', mots: arbre.verbe.mots });
        if (arbre.cod) {
            if (arbre.cod.type === 'GInf') {
                fonctions.push({ label: 'COD (Infinitif)', mots: arbre.cod.mots });
            } else {
                fonctions.push({ label: 'COD', mots: arbre.cod.mots });
            }
        }
        if (arbre.attribut) fonctions.push({ label: 'Attribut du Sujet', mots: arbre.attribut.mots });

        // Recherche des fonctions à l'intérieur des Groupes Nominaux (Sujet et COD)
        const groupesAAnalyser = [arbre.sujet, arbre.cod].filter(Boolean);

        groupesAAnalyser.forEach(group => {
            // On n'analyse les épithètes et compléments du nom que dans les GN
            if (group.type !== 'GN') return;

            let inComplement = false;
            group.mots.forEach((mot, index) => {
                if (mot.type === 'adjectif') {
                    fonctions.push({ label: 'Épithète', mots: [mot] });
                }
                if (['à', 'de', 'en'].includes(mot.text) && group.mots.slice(index + 1).length > 0) {
                    fonctions.push({ label: 'C. du Nom', mots: group.mots.slice(index) });
                }
            });
        });

        return fonctions;
    }
};