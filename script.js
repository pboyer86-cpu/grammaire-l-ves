// Fonction pour basculer l'ouverture/fermeture des catégories
function toggleCategory(header) {
  const content = header.nextElementSibling;
  const toggle = header.querySelector('.category-toggle');
  
  content.classList.toggle('open');
  toggle.classList.toggle('open');
}

// Fonction pour initialiser SortableJS sur tous les conteneurs de mots
function initializeDragDrop() {
  // Récupérer tous les conteneurs qui contiennent des mots
  const wordContainers = document.querySelectorAll('.subcategory, .category-content');
  
  wordContainers.forEach(container => {
    // Vérifier si le conteneur a des mots directs
    const hasWords = container.querySelector('.word');
    if (hasWords) {
      Sortable.create(container, {
        group: { name: 'words', pull: 'clone', put: false },
        sort: false,
        animation: 150,
        draggable: '.word'
      });
    }
  });
}

// Initialiser le drag & drop
initializeDragDrop();

// Zone de phrase : peut recevoir des clones et réorganiser
Sortable.create(document.getElementById('sentence-area'), {
  group: { name: 'words', pull: false, put: true },
  animation: 150,
  handle: '.word',
  draggable: '.word',
  onAdd: function(evt) {
    // Ajouter un bouton de suppression sur chaque mot ajouté
    const word = evt.item;
    // Attribuer un ID unique pour un suivi fiable
    word.dataset.wordId = `word-${Date.now()}-${Math.random()}`;

    if (!word.querySelector('.remove-btn')) {
      const removeBtn = document.createElement('span');
      removeBtn.textContent = '×';
      removeBtn.className = 'remove-btn';
      removeBtn.title = 'Supprimer ce mot';
      removeBtn.onclick = function(e) {
        e.stopPropagation();
        word.remove();
      };
      word.appendChild(removeBtn);
    }
  }
});

// Bouton de vérification
document.getElementById("check-btn").addEventListener("click", () => {
  const sentenceArea = document.getElementById("sentence-area");
  const domWords = [...sentenceArea.children];
  const words = [...sentenceArea.children].map(w => ({
    text: w.textContent.trim().replace('×', '').trim(),
    id: w.dataset.wordId, // On passe l'ID unique au correcteur
    type: w.dataset.type,
    subtype: w.dataset.subtype || "",
    gender: w.dataset.gender || "",
    person: w.dataset.person || "",
    number: w.dataset.number || "",
    mode: w.dataset.mode || ""
  }));

  const result = document.getElementById("result");
  result.className = "";

  const functionsArea = document.getElementById("functions-area");
  functionsArea.innerHTML = ""; // Vider les anciennes fonctions
  result.textContent = "";

  // On appelle notre nouveau moteur NLP !
  const validationResult = Correcteur2.analyserPhrase(words);

  // On affiche le résultat qu'il nous renvoie.
  result.textContent = validationResult.message;
  if (validationResult.valide) {
    result.className = "success";
  } else {
    result.className = "error";
  }

  // Afficher les fonctions grammaticales si l'arbre a été généré
  if (validationResult.arbre) {
    const arbre = validationResult.arbre;

    // Fonction pour dessiner une étiquette de fonction
    const drawFunctionLabel = (func) => {
      if (!func || !func.mots || func.mots.length === 0) return;

      const functionName = func.label;
      const groupWords = func.mots;

      // Retrouver les éléments DOM de manière fiable grâce à leur ID unique
      const firstWordId = groupWords[0].id;
      const lastWordId = groupWords[groupWords.length - 1].id;

      const startIndex = domWords.findIndex(w => w.dataset.wordId === firstWordId);
      const endIndex = domWords.findIndex(w => w.dataset.wordId === lastWordId);

      const firstDomWord = domWords[startIndex];
      const lastDomWord = domWords[endIndex];

      // Calculer la position et la largeur du groupe
      const startPosition = firstDomWord.offsetLeft;
      const endPosition = lastDomWord.offsetLeft + lastDomWord.offsetWidth;
      const width = endPosition - startPosition;

      // Créer l'élément visuel pour le groupe
      const groupContainer = document.createElement('div');
      groupContainer.className = 'function-group';

      // Ajouter une classe pour le positionnement vertical
      const mainFunctions = ['Sujet', 'Verbe', 'COD', 'Attribut du Sujet'];
      if (mainFunctions.includes(functionName)) {
        groupContainer.classList.add('main-function');
      } else {
        groupContainer.classList.add('inner-function');
      }

      groupContainer.style.left = `${startPosition}px`;
      groupContainer.style.width = `${width}px`;

      const line = document.createElement('div');
      line.className = 'function-line';

      const label = document.createElement('span');
      label.className = 'function-label';
      label.textContent = functionName;

      groupContainer.appendChild(line);
      groupContainer.appendChild(label);
      functionsArea.appendChild(groupContainer);
    };

    // Parcourir et dessiner toutes les fonctions détaillées trouvées
    if (arbre.fonctionsDetaillees) {
      arbre.fonctionsDetaillees.forEach(func => drawFunctionLabel(func));
    }
  }
});

// Bouton de réinitialisation
document.getElementById("reset-btn").addEventListener("click", () => {
  document.getElementById("sentence-area").innerHTML = "";
  document.getElementById("result").textContent = "";
  document.getElementById("result").className = "";
  document.getElementById("functions-area").innerHTML = "";
});

const adjModal = document.getElementById('adjective-gender-modal');
let adjectiveToAdd = null;

const verbModal = document.getElementById('verb-conjugation-modal');
let verbToConjugate = null;

const nounModal = document.getElementById('noun-number-modal');
let nounToNumber = null;

const elisionModal = document.getElementById('elision-modal');
let wordToElide = null;

// Fonction pour ajouter un mot (avec gestion de l'accord)
function addWordToSentence(wordNode, options = {}) {
  const sentenceArea = document.getElementById("sentence-area");
  const newWord = wordNode.cloneNode(true);

  // Attribuer un ID unique pour un suivi fiable
  newWord.dataset.wordId = `word-${Date.now()}-${Math.random()}`;

  // Appliquer les modifications (genre, texte)
  if (options.gender) newWord.dataset.gender = options.gender;
  if (options.text) newWord.firstChild.nodeValue = options.text + ' ';
  if (options.person) newWord.dataset.person = options.person;
  if (options.mode) newWord.dataset.mode = options.mode;

  if (options.number) newWord.dataset.number = options.number;

  // Créer le bouton de suppression
  const removeBtn = document.createElement('span');
  removeBtn.textContent = '×';
  removeBtn.className = 'remove-btn';
  removeBtn.title = 'Supprimer ce mot';
  removeBtn.onclick = (e) => { e.stopPropagation(); newWord.remove(); };
  newWord.appendChild(removeBtn);

  sentenceArea.appendChild(newWord);
}

// Attacher l'événement de clic à chaque mot de la banque
document.querySelectorAll("#word-bank .word").forEach(wordNode => {
  // Liste des mots qui déclenchent la modale d'élision
  const WORDS_THAT_ELIDE = ['je', 'ne', 'me', 'te', 'se', 'le', 'de', 'que'];

  wordNode.addEventListener("click", () => {
    const wordText = wordNode.textContent.trim();

    if (WORDS_THAT_ELIDE.includes(wordText) && wordNode.dataset.elided) {
      wordToElide = wordNode;
      updateElisionModal(wordToElide);
      elisionModal.classList.add('visible');
    } else if (wordNode.dataset.type === 'adjectif') {
      adjectiveToAdd = wordNode;
      updateAdjectiveModal(adjectiveToAdd);
      adjModal.classList.add('visible');
    } else if (wordNode.dataset.type === 'nom' && wordNode.dataset.subtype === 'commun') {
      nounToNumber = wordNode;
      nounModal.classList.add('visible');
    } else if (wordNode.dataset.type === 'verbe') {
      verbToConjugate = wordNode;
      showModeSelection(verbToConjugate);
      verbModal.classList.add('visible'); // Afficher la modale
    } else {
      // Sinon, ajouter directement
      addWordToSentence(wordNode);
    }
  });
});

// --- Logique de la modale des verbes en plusieurs étapes ---

function showModeSelection(verbNode) {
  const modalContent = verbModal.querySelector('.modal-content');
  modalContent.innerHTML = '';

  const closeBtn = document.createElement('span');
  closeBtn.className = 'modal-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => verbModal.classList.remove('visible');
  modalContent.appendChild(closeBtn);

  const title = document.createElement('p');
  title.textContent = `Choisir un mode pour "${verbNode.dataset.infinitive}" :`;
  modalContent.appendChild(title);

  const indicatifBtn = document.createElement('button');
  indicatifBtn.textContent = 'Indicatif';
  indicatifBtn.onclick = () => showTenseSelection(verbNode, 'indicatif');
  modalContent.appendChild(indicatifBtn);

  const infinitifBtn = document.createElement('button');
  infinitifBtn.textContent = 'Infinitif';
  infinitifBtn.onclick = () => {
    addWordToSentence(verbNode, { text: verbNode.dataset.infinitive, mode: 'infinitif' });
    verbModal.classList.remove('visible');
    
  };
  modalContent.appendChild(infinitifBtn);

  const subjonctifBtn = document.createElement('button');
  subjonctifBtn.textContent = 'Subjonctif';
  subjonctifBtn.onclick = () => showSubjonctifTenseSelection(verbNode);
  modalContent.appendChild(subjonctifBtn);

  const participeBtn = document.createElement('button');
  participeBtn.textContent = 'Participe';
  participeBtn.onclick = () => showParticipeTenseSelection(verbNode);
  modalContent.appendChild(participeBtn);
}

function showTenseSelection(verbNode, mode) { // Added mode parameter
  const modalContent = verbModal.querySelector('.modal-content');
  modalContent.innerHTML = '';

  // Bouton Retour
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Retour (Modes)';
  backBtn.onclick = () => showModeSelection(verbNode); // Always go back to mode selection
  modalContent.appendChild(backBtn);

  const title = document.createElement('p');
  title.textContent = 'Choisir un temps :';
  modalContent.appendChild(title);

  const columnsContainer = document.createElement('div');
  columnsContainer.className = 'tense-columns';

  const simpleColumn = document.createElement('div');
  simpleColumn.className = 'tense-column simple-tenses';
  simpleColumn.innerHTML = '<h5>Temps simples</h5>';

  const composedColumn = document.createElement('div');
  composedColumn.className = 'tense-column composed-tenses';
  composedColumn.innerHTML = '<h5>Temps composés</h5>';

  const tenses = {
    simple: [
      { key: 'present', label: 'Présent' },
      { key: 'imparfait', label: 'Imparfait' },
      { key: 'ps', label: 'Passé Simple' },
      { key: 'futur', label: 'Futur Simple' },
      { key: 'cond', label: 'Conditionnel Présent' }
    ],
    composed: [
      { key: 'pc', label: 'Passé Composé' },
      { key: 'pqp', label: 'Plus-que-parfait' },
      { key: 'pa', label: 'Passé Antérieur' },
      { key: 'futura', label: 'Futur Antérieur' },
      { key: 'condp', label: 'Conditionnel Passé' }
    ]
  };

  // Fonction pour créer et ajouter un bouton de temps
  const createTenseButton = (tenseInfo, targetColumn) => {
    const keyPrefix = tenseInfo.key;
    // Vérifie si au moins une forme de ce temps existe pour ce verbe
    const hasTense = ['je', 'tu', 'il', 'nous', 'vous', 'ils'].some(p => verbNode.dataset[keyPrefix + p.charAt(0).toUpperCase() + p.slice(1)]);

    if (hasTense) {
      const button = document.createElement('button');
      button.textContent = tenseInfo.label;
      button.onclick = () => showPersonSelection(verbNode, mode, keyPrefix); // Pass mode
      targetColumn.appendChild(button);
    }
  };

  // Remplir les colonnes avec les boutons correspondants
  tenses.simple.forEach(tense => {
    createTenseButton(tense, simpleColumn);
  });
  tenses.composed.forEach(tense => {
    createTenseButton(tense, composedColumn);
  });

  // Ajouter les colonnes au conteneur principal, puis à la modale
  columnsContainer.appendChild(simpleColumn);
  columnsContainer.appendChild(composedColumn);
  modalContent.appendChild(columnsContainer);
}

function showPersonSelection(verbNode, mode, tense) { // Added mode parameter
  const modalContent = verbModal.querySelector('.modal-content');
  modalContent.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Retour (Temps)';
  if (mode === 'indicatif') {
    backBtn.onclick = () => showTenseSelection(verbNode, mode);
  } else if (mode === 'subjonctif') {
    backBtn.onclick = () => showSubjonctifTenseSelection(verbNode);
  }
  modalContent.appendChild(backBtn);

  const title = document.createElement('p');
  title.textContent = 'Choisir une personne :';
  modalContent.appendChild(title);

  const persons = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
  persons.forEach(person => {
    let datasetKey;
    if (mode === 'indicatif') {
      datasetKey = tense + person.charAt(0).toUpperCase() + person.slice(1);
    } else if (mode === 'subjonctif') {
      // tense here would be 'present', 'imparfait', 'passe', 'plusqueparfait'
      
      datasetKey = mode + tense.charAt(0).toUpperCase() + tense.slice(1) + person.charAt(0).toUpperCase() + person.slice(1);
    } else { return; } // Should not happen

    const conjugatedForm = verbNode.dataset[datasetKey];
    if (!conjugatedForm) return;

    const button = document.createElement('button');
    button.textContent = conjugatedForm;
    button.onclick = () => {
      // Si le mode est subjonctif, on passe à l'étape de choix de forme
      if (mode === 'subjonctif') {
        showSubjunctiveFormChoice(verbNode, person, conjugatedForm, tense);
      } else {
        // Sinon, on ajoute directement le mot
        addWordToSentence(verbNode, { text: conjugatedForm, person: person, mode: mode, tense: tense });
        verbModal.classList.remove('visible');
      }
    };
    modalContent.appendChild(button);
  });
}

// New function for Subjonctif tense selection
function showSubjonctifTenseSelection(verbNode) {
  const modalContent = verbModal.querySelector('.modal-content');
  modalContent.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Retour (Modes)';
  backBtn.onclick = () => showModeSelection(verbNode);
  modalContent.appendChild(backBtn);

  const title = document.createElement('p');
  title.textContent = 'Choisir un temps (Subjonctif) :';
  modalContent.appendChild(title);

  const columnsContainer = document.createElement('div');
  columnsContainer.className = 'tense-columns';

  const simpleColumn = document.createElement('div');
  simpleColumn.className = 'tense-column simple-tenses';
  simpleColumn.innerHTML = '<h5>Temps simples</h5>';

  const composedColumn = document.createElement('div');
  composedColumn.className = 'tense-column composed-tenses';
  composedColumn.innerHTML = '<h5>Temps composés</h5>';

  const tenses = {
    simple: [
      { key: 'subjonctifPresent', label: 'Présent' },
      { key: 'subjonctifImparfait', label: 'Imparfait' }
    ],
    composed: [
      { key: 'subjonctifPasse', label: 'Passé' },
      { key: 'subjonctifPlusqueparfait', label: 'Plus-que-parfait' }
    ]
  };

  const createTenseButton = (tenseInfo, targetColumn) => {
    const hasTense = ['je', 'tu', 'il', 'nous', 'vous', 'ils'].some(p => verbNode.dataset[tenseInfo.key + p.charAt(0).toUpperCase() + p.slice(1)]);

    if (hasTense) {
      const button = document.createElement('button');
      button.textContent = tenseInfo.label;
      button.onclick = () => showPersonSelection(verbNode, 'subjonctif', tenseInfo.key.replace('subjonctif', '').toLowerCase());
      targetColumn.appendChild(button);
    }
  };

  tenses.simple.forEach(tense => {
    createTenseButton(tense, simpleColumn);
  });
  tenses.composed.forEach(tense => {
    createTenseButton(tense, composedColumn);
  });

  columnsContainer.appendChild(simpleColumn);
  columnsContainer.appendChild(composedColumn);
  modalContent.appendChild(columnsContainer);
}

// New function for Participe tense selection
function showParticipeTenseSelection(verbNode) {
  const modalContent = verbModal.querySelector('.modal-content');
  modalContent.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Retour (Modes)';
  backBtn.onclick = () => showModeSelection(verbNode);
  modalContent.appendChild(backBtn);

  const title = document.createElement('p');
  title.textContent = 'Choisir un temps (Participe) :';
  modalContent.appendChild(title);

  const tenses = [
    { key: 'participePresent', label: 'Présent' },
    { key: 'participePasse', label: 'Passé' }
  ];

  tenses.forEach(tenseInfo => {
    const conjugatedForm = verbNode.dataset[tenseInfo.key];
    if (conjugatedForm) {
      const button = document.createElement('button');
      button.textContent = conjugatedForm + ` (${tenseInfo.label})`;
      button.onclick = () => {
        addWordToSentence(verbNode, {
          text: conjugatedForm,
          mode: 'participe',
          tense: tenseInfo.key.replace('participe', '').toLowerCase()
        });
        verbModal.classList.remove('visible');
      };
      modalContent.appendChild(button);
    }
  });
}

// --- Logique de la modale d'élision ---
function updateElisionModal(wordNode) {
  const modalContent = elisionModal.querySelector('.modal-content');
  modalContent.innerHTML = ''; // Vider

  const closeBtn = document.createElement('span');
  closeBtn.className = 'modal-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => elisionModal.classList.remove('visible'); // Correction ici
  modalContent.appendChild(closeBtn);

  const title = document.createElement('p');
  title.textContent = `Choisir la forme pour "${wordNode.textContent.trim()}" :`;
  modalContent.appendChild(title);

  // Bouton pour la forme pleine (ex: "je")
  const fullFormBtn = document.createElement('button');
  fullFormBtn.textContent = wordNode.textContent.trim();
  fullFormBtn.onclick = () => {
    addWordToSentence(wordNode); // Ajoute la forme de base
    elisionModal.classList.remove('visible');
  };
  modalContent.appendChild(fullFormBtn);

  // Bouton pour la forme élidée (ex: "j'")
  const elidedFormBtn = document.createElement('button');
  elidedFormBtn.textContent = wordNode.dataset.elided;
  elidedFormBtn.onclick = () => {
    addWordToSentence(wordNode, { text: wordNode.dataset.elided, gender: 'elision' });
    elisionModal.classList.remove('visible');
  };
  modalContent.appendChild(elidedFormBtn);
}

// Gérer la modale des noms
nounModal.querySelector('#noun-singular').addEventListener('click', () => {
  addWordToSentence(nounToNumber, { number: 'singulier' });
  nounModal.classList.remove('visible');
});
nounModal.querySelector('#noun-plural').addEventListener('click', () => {
  addWordToSentence(nounToNumber, { number: 'pluriel', text: nounToNumber.dataset.plural });
  nounModal.classList.remove('visible');
});

// Mettre à jour et gérer la modale des adjectifs
function updateAdjectiveModal(adjNode) {
  const modalContent = adjModal.querySelector('.modal-content');
  modalContent.innerHTML = ''; // Vider

  const closeBtn = document.createElement('span');
  closeBtn.className = 'modal-close-btn';
  closeBtn.innerHTML = '&times;';

  closeBtn.onclick = () => adjModal.classList.remove('visible');
  modalContent.appendChild(closeBtn);

  const title = document.createElement('p');
  title.textContent = `Accorder "${adjNode.textContent.trim()}" :`;
  modalContent.appendChild(title);

  const options = [
    { text: adjNode.textContent.trim() + ' (masc. sing.)', gender: 'masculin', number: 'singulier', newText: adjNode.textContent.trim() },
    { text: adjNode.dataset.feminine + ' (fém. sing.)', gender: 'feminin', number: 'singulier', newText: adjNode.dataset.feminine },
    { text: adjNode.dataset.plural + ' (masc. plur.)', gender: 'masculin', number: 'pluriel', newText: adjNode.dataset.plural },
    { text: adjNode.dataset.femininePlural + ' (fém. plur.)', gender: 'feminin', number: 'pluriel', newText: adjNode.dataset.femininePlural }
  ];

  options.forEach(opt => {
    if (!opt.newText) return; // Ne pas créer de bouton si la forme n'existe pas
    const button = document.createElement('button');
    button.textContent = opt.text;
    button.onclick = () => {
      addWordToSentence(adjNode, { text: opt.newText, gender: opt.gender, number: opt.number });
      adjModal.classList.remove('visible');
    };
    modalContent.appendChild(button);
  });
}

// --- Fermeture des modales en cliquant à l'extérieur ---
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (event) => {
    // Si la cible du clic est l'overlay lui-même (le fond) et non son contenu
    if (event.target === modal) {
      modal.classList.remove('visible');
    }
  });
});