import type { DishKind, MainKind, RecipeTemplate } from './types';

/** Dishes a guest can pick as their main course. The rest are sides that attach to a main. */
export const MAIN_KINDS: readonly MainKind[] = ['pizza', 'primo', 'secondo'];
export const isMain = (kind: DishKind): kind is MainKind => (MAIN_KINDS as readonly DishKind[]).includes(kind);

/** What a custom dish starts from: a pizza always has its base, a primo picks one of these, a secondo starts bare. */
export const PIZZA_BASE: readonly string[] = ['dough', 'tomatoSauce', 'mozzarella'];
export const PRIMO_BASES: readonly string[] = ['spaghetti', 'freshPasta', 'rice', 'gnocchi'];

/** Starter menu (balance.md 2.1) plus the recipe book the player can put on the menu. */
export const RECIPE_BOOK: readonly RecipeTemplate[] = [
  { id: 'margherita', name: 'Margherita', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'basil', 'oliveOil'], price: 11, onMenu: true },
  { id: 'pepperoni', name: 'Pepperoni', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'pepperoni'], price: 13, onMenu: true },
  { id: 'funghi', name: 'Funghi', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'mushrooms', 'oliveOil'], price: 12, onMenu: true },
  { id: 'quattroFormaggi', name: 'Quattro Formaggi', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'gorgonzola', 'parmesan'], price: 13, onMenu: true },
  { id: 'prosciuttoRucola', name: 'Prosciutto e Rucola', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'prosciutto', 'rocket', 'parmesan'], price: 15, onMenu: false },
  { id: 'diavola', name: 'Diavola', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'nduja', 'chili', 'ricotta'], price: 14, onMenu: false },
  { id: 'prosciuttoFunghi', name: 'Prosciutto e Funghi', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'ham', 'mushrooms'], price: 13, onMenu: false },
  { id: 'burrata', name: 'Burrata e Pomodorini', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'burrata', 'cherryTomatoes', 'basil', 'oliveOil'], price: 16, onMenu: false },
  { id: 'salsiccia', name: 'Salsiccia e Cipolla', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'sausage', 'onion'], price: 13, onMenu: false },
  { id: 'tartufo', name: 'Funghi e Tartufo', kind: 'pizza', ingredients: ['dough', 'mozzarella', 'mushrooms', 'truffleOil', 'parmesan'], price: 17, onMenu: false },
  { id: 'napoli', name: 'Napoli', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'anchovy', 'olives'], price: 13, onMenu: false },
  { id: 'hawaii', name: 'Hawaii', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'ham', 'pineapple'], price: 12, onMenu: false },
  { id: 'verdure', name: 'Verdure', kind: 'pizza', ingredients: ['dough', 'tomatoSauce', 'mozzarella', 'peppers', 'onion', 'olives', 'mushrooms'], price: 13, onMenu: false },

  // Primi piatti: cooked to order on the stove, so they spare the oven but keep the prep line busy.
  { id: 'pomodoro', name: 'Spaghetti al pomodoro', kind: 'primo', ingredients: ['spaghetti', 'tomatoSauce', 'basil', 'parmesan'], price: 11, onMenu: false },
  { id: 'cacioPepe', name: 'Cacio e pepe', kind: 'primo', ingredients: ['spaghetti', 'pecorino', 'butter'], price: 12, onMenu: false },
  { id: 'carbonara', name: 'Carbonara', kind: 'primo', ingredients: ['spaghetti', 'guanciale', 'eggs', 'pecorino'], price: 14, onMenu: false },
  { id: 'amatriciana', name: 'Amatriciana', kind: 'primo', ingredients: ['spaghetti', 'tomatoSauce', 'guanciale', 'pecorino', 'chili'], price: 14, onMenu: false },
  { id: 'pestoGenovese', name: 'Trofie al pesto', kind: 'primo', ingredients: ['freshPasta', 'pesto', 'potatoes', 'parmesan'], price: 13, onMenu: false },
  { id: 'tagliatelleRagu', name: 'Tagliatelle al ragù', kind: 'primo', ingredients: ['freshPasta', 'ragu', 'parmesan'], price: 15, onMenu: false },
  { id: 'lasagne', name: 'Lasagne al forno', kind: 'primo', ingredients: ['freshPasta', 'ragu', 'bechamel', 'parmesan'], price: 15, onMenu: false },
  { id: 'vongole', name: 'Spaghetti alle vongole', kind: 'primo', ingredients: ['spaghetti', 'clams', 'garlic', 'whiteWine', 'parsley'], price: 18, onMenu: false },
  { id: 'linguineGamberi', name: 'Linguine ai gamberi', kind: 'primo', ingredients: ['spaghetti', 'prawns', 'zucchini', 'garlic', 'chili'], price: 18, onMenu: false },
  { id: 'gnocchiSorrentina', name: 'Gnocchi alla sorrentina', kind: 'primo', ingredients: ['gnocchi', 'tomatoSauce', 'mozzarella', 'basil'], price: 13, onMenu: false },
  { id: 'gnocchiSalvia', name: 'Gnocchi burro e salvia', kind: 'primo', ingredients: ['gnocchi', 'butter', 'sage', 'parmesan'], price: 13, onMenu: false },
  { id: 'ravioliZucca', name: 'Ravioli di zucca', kind: 'primo', ingredients: ['freshPasta', 'pumpkin', 'butter', 'sage', 'parmesan'], price: 17, onMenu: false },
  { id: 'risottoMilanese', name: 'Risotto alla milanese', kind: 'primo', ingredients: ['rice', 'saffron', 'butter', 'parmesan'], price: 17, onMenu: false },
  { id: 'risottoPorcini', name: 'Risotto ai porcini', kind: 'primo', ingredients: ['rice', 'porcini', 'butter', 'whiteWine', 'parmesan'], price: 19, onMenu: false },
  { id: 'risottoAsparagi', name: 'Risotto agli asparagi', kind: 'primo', ingredients: ['rice', 'asparagus', 'butter', 'parmesan'], price: 18, onMenu: false },

  // Secondi: the fanciest plates on the menu and the most work at the pass.
  { id: 'parmigiana', name: 'Parmigiana di melanzane', kind: 'secondo', ingredients: ['aubergine', 'tomatoSauce', 'mozzarella', 'parmesan', 'basil'], price: 16, onMenu: false },
  { id: 'cacciatora', name: 'Pollo alla cacciatora', kind: 'secondo', ingredients: ['chicken', 'tomatoSauce', 'olives', 'rosemary'], price: 18, onMenu: false },
  { id: 'porchetta', name: 'Porchetta con patate', kind: 'secondo', ingredients: ['pork', 'rosemary', 'garlic', 'potatoes'], price: 20, onMenu: false },
  { id: 'frittoMisto', name: 'Fritto misto di mare', kind: 'secondo', ingredients: ['squid', 'prawns', 'lemon'], price: 20, onMenu: false },
  { id: 'scaloppine', name: 'Scaloppine al limone', kind: 'secondo', ingredients: ['veal', 'lemon', 'butter', 'capers', 'parsley'], price: 22, onMenu: false },
  { id: 'saltimbocca', name: 'Saltimbocca alla romana', kind: 'secondo', ingredients: ['veal', 'prosciutto', 'sage', 'butter', 'whiteWine'], price: 23, onMenu: false },
  { id: 'branzino', name: 'Branzino al forno', kind: 'secondo', ingredients: ['seaBass', 'lemon', 'potatoes', 'rosemary'], price: 25, onMenu: false },
  { id: 'tagliata', name: 'Tagliata di manzo', kind: 'secondo', ingredients: ['beef', 'rocket', 'parmesan', 'oliveOil'], price: 26, onMenu: false },
  { id: 'ossobuco', name: 'Ossobuco alla milanese', kind: 'secondo', ingredients: ['vealShank', 'tomatoSauce', 'whiteWine', 'lemon', 'parsley'], price: 28, onMenu: false },

  { id: 'garlicBread', name: 'Garlic bread', kind: 'starter', ingredients: ['bread', 'garlicButter'], price: 6, onMenu: true, tags: ['classic', 'kid friendly'] },
  { id: 'bruschetta', name: 'Bruschetta', kind: 'starter', ingredients: ['bread', 'cherryTomatoes', 'basil', 'oliveOil'], price: 7, onMenu: false, tags: ['classic'] },
  { id: 'caprese', name: 'Caprese', kind: 'starter', ingredients: ['mozzarella', 'cherryTomatoes', 'basil', 'oliveOil'], price: 8, onMenu: false, tags: ['classic'] },
  { id: 'calamari', name: 'Calamari fritti', kind: 'starter', ingredients: ['squid', 'lemon'], price: 9, onMenu: false },
  { id: 'carpaccio', name: 'Carpaccio di manzo', kind: 'starter', ingredients: ['beef', 'rocket', 'parmesan'], price: 12, onMenu: false },

  { id: 'softDrink', name: 'Soft drink', kind: 'drink', ingredients: ['softDrink'], price: 3.5, onMenu: true, tags: ['kid friendly'] },
  { id: 'houseWine', name: 'House wine', kind: 'drink', ingredients: ['houseWine'], price: 5, onMenu: true, tags: ['classic'] },
  { id: 'craftBeer', name: 'Craft beer', kind: 'drink', ingredients: ['craftBeer'], price: 5.5, onMenu: false },

  { id: 'tiramisu', name: 'Tiramisu', kind: 'dessert', ingredients: ['mascarpone'], price: 6, onMenu: true, tags: ['classic'] },
  { id: 'pannaCotta', name: 'Panna cotta', kind: 'dessert', ingredients: ['cream'], price: 6, onMenu: false, tags: ['classic'] },
  { id: 'gelato', name: 'Gelato', kind: 'dessert', ingredients: ['gelato'], price: 5, onMenu: false },
];
