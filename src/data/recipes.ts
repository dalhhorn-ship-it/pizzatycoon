import { T } from './tunables';
import type { DishKind, MainKind, RecipeTemplate } from './types';

/** Dishes a guest can pick as their main course. The rest are sides that attach to a main. */
export const MAIN_KINDS: readonly MainKind[] = ['pizza', 'primo', 'secondo'];
export const isMain = (kind: DishKind): kind is MainKind => (MAIN_KINDS as readonly DishKind[]).includes(kind);

/** Kinds served from the bar: no kitchen work, no menu complexity. */
export const BAR_KINDS: readonly DishKind[] = ['drink', 'aperitivo', 'digestivo'];
export const isBar = (kind: DishKind): boolean => BAR_KINDS.includes(kind);

/** How many items of the same section (food or bar) are on a menu, and that section's limit. */
export function menuSection(recipes: readonly { kind: DishKind; onMenu: boolean }[], kind: DishKind): { name: string; count: number; max: number } {
  const bar = isBar(kind);
  return {
    name: bar ? 'bar' : 'food',
    count: recipes.filter((r) => r.onMenu && isBar(r.kind) === bar).length,
    max: bar ? T.build.menuMaxBar : T.build.menuMaxFood,
  };
}

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
  { id: 'houseWine', name: 'House wine', kind: 'drink', ingredients: ['houseWine'], price: 5, onMenu: true, tags: ['classic'], wine: true },
  { id: 'craftBeer', name: 'Craft beer', kind: 'drink', ingredients: ['craftBeer'], price: 5.5, onMenu: false },
  { id: 'sparklingWater', name: 'Sparkling water', kind: 'drink', ingredients: ['sparklingWater'], price: 3, onMenu: false, tags: ['kid friendly'] },
  { id: 'lager', name: 'Italian lager', kind: 'drink', ingredients: ['lager'], price: 4.5, onMenu: false },
  // The wine list (by the glass). Every extra wine on the menu gets more guests ordering a second glass.
  { id: 'prosecco', name: 'Prosecco', kind: 'drink', ingredients: ['prosecco'], price: 7, onMenu: false, wine: true },
  { id: 'pinotGrigio', name: 'Pinot Grigio', kind: 'drink', ingredients: ['pinotGrigio'], price: 7, onMenu: false, wine: true },
  { id: 'montepulciano', name: "Montepulciano d'Abruzzo", kind: 'drink', ingredients: ['montepulciano'], price: 6.5, onMenu: false, wine: true },
  { id: 'chianti', name: 'Chianti Classico', kind: 'drink', ingredients: ['chianti'], price: 8, onMenu: false, wine: true },
  { id: 'barolo', name: 'Barolo', kind: 'drink', ingredients: ['barolo'], price: 14, onMenu: false, wine: true },
  { id: 'brunello', name: 'Brunello di Montalcino', kind: 'drink', ingredients: ['brunello'], price: 15, onMenu: false, wine: true },
  { id: 'lambrusco', name: 'Lambrusco', kind: 'drink', ingredients: ['lambrusco'], price: 6, onMenu: false, wine: true },
  { id: 'neroDavola', name: "Nero d'Avola", kind: 'drink', ingredients: ['neroDavola'], price: 6.5, onMenu: false, wine: true },
  { id: 'soave', name: 'Soave Classico', kind: 'drink', ingredients: ['soave'], price: 7, onMenu: false, wine: true },
  { id: 'vermentino', name: 'Vermentino di Sardegna', kind: 'drink', ingredients: ['vermentino'], price: 7.5, onMenu: false, wine: true },
  { id: 'primitivo', name: 'Primitivo di Manduria', kind: 'drink', ingredients: ['primitivo'], price: 8, onMenu: false, wine: true },
  { id: 'franciacorta', name: 'Franciacorta', kind: 'drink', ingredients: ['franciacorta'], price: 11, onMenu: false, wine: true },
  { id: 'barbaresco', name: 'Barbaresco', kind: 'drink', ingredients: ['barbaresco'], price: 13, onMenu: false, wine: true },
  { id: 'amarone', name: 'Amarone della Valpolicella', kind: 'drink', ingredients: ['amarone'], price: 15, onMenu: false, wine: true },
  { id: 'tignanello', name: 'Tignanello', kind: 'drink', ingredients: ['tignanello'], price: 19, onMenu: false, wine: true },
  { id: 'sassicaia', name: 'Sassicaia', kind: 'drink', ingredients: ['sassicaia'], price: 26, onMenu: false, wine: true },

  // Aperitivi: before dinner. Guests linger a little longer.
  { id: 'spritz', name: 'Aperol Spritz', kind: 'aperitivo', ingredients: ['aperol'], price: 8, onMenu: false },
  { id: 'negroni', name: 'Negroni', kind: 'aperitivo', ingredients: ['campari', 'ginVermouth'], price: 10, onMenu: false },
  { id: 'bellini', name: 'Bellini', kind: 'aperitivo', ingredients: ['peachPuree'], price: 9, onMenu: false },
  { id: 'campariSoda', name: 'Campari Soda', kind: 'aperitivo', ingredients: ['campari'], price: 6.5, onMenu: false },

  // Digestivi: after dinner, the last part of the bill.
  { id: 'espresso', name: 'Espresso', kind: 'digestivo', ingredients: ['espresso'], price: 3, onMenu: false },
  { id: 'limoncello', name: 'Limoncello', kind: 'digestivo', ingredients: ['limoncello'], price: 6, onMenu: false },
  { id: 'grappa', name: 'Grappa', kind: 'digestivo', ingredients: ['grappa'], price: 7, onMenu: false },
  { id: 'grappaRiserva', name: 'Grappa riserva', kind: 'digestivo', ingredients: ['grappaRiserva'], price: 12, onMenu: false },
  { id: 'amaro', name: 'Amaro', kind: 'digestivo', ingredients: ['amaro'], price: 7, onMenu: false },
  { id: 'sambuca', name: 'Sambuca', kind: 'digestivo', ingredients: ['sambuca'], price: 6, onMenu: false },

  { id: 'tiramisu', name: 'Tiramisu', kind: 'dessert', ingredients: ['mascarpone'], price: 6, onMenu: true, tags: ['classic'] },
  { id: 'pannaCotta', name: 'Panna cotta', kind: 'dessert', ingredients: ['cream'], price: 6, onMenu: false, tags: ['classic'] },
  { id: 'gelato', name: 'Gelato', kind: 'dessert', ingredients: ['gelato'], price: 5, onMenu: false },
];

/** Recipe book ids of wines. */
export const WINE_IDS: ReadonlySet<string> = new Set(RECIPE_BOOK.filter((r) => r.wine).map((r) => r.id));
