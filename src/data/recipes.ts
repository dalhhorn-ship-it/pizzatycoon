import type { RecipeTemplate } from './types';

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

  { id: 'garlicBread', name: 'Garlic bread', kind: 'starter', ingredients: ['bread', 'garlicButter'], price: 6, onMenu: true, tags: ['classic', 'kid friendly'] },
  { id: 'bruschetta', name: 'Bruschetta', kind: 'starter', ingredients: ['bread', 'cherryTomatoes', 'basil', 'oliveOil'], price: 7, onMenu: false, tags: ['classic'] },

  { id: 'softDrink', name: 'Soft drink', kind: 'drink', ingredients: ['softDrink'], price: 3.5, onMenu: true, tags: ['kid friendly'] },
  { id: 'houseWine', name: 'House wine', kind: 'drink', ingredients: ['houseWine'], price: 5, onMenu: true, tags: ['classic'] },
  { id: 'craftBeer', name: 'Craft beer', kind: 'drink', ingredients: ['craftBeer'], price: 5.5, onMenu: false },

  { id: 'tiramisu', name: 'Tiramisu', kind: 'dessert', ingredients: ['mascarpone'], price: 6, onMenu: true, tags: ['classic'] },
  { id: 'pannaCotta', name: 'Panna cotta', kind: 'dessert', ingredients: ['cream'], price: 6, onMenu: false, tags: ['classic'] },
  { id: 'gelato', name: 'Gelato', kind: 'dessert', ingredients: ['gelato'], price: 5, onMenu: false },
];
