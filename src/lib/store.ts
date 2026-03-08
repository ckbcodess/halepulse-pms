import { create } from 'zustand';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, delta: number) => void;
  clearCart: () => void;
  total: number;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  total: 0,
  addItem: (item) => set((state) => {
    const existing = state.items.find((i) => i.id === item.id);
    let newItems;
    if (existing) {
      newItems = state.items.map((i) =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      );
    } else {
      newItems = [...state.items, item];
    }
    const newTotal = newItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    return { items: newItems, total: newTotal };
  }),
  removeItem: (id) => set((state) => {
    const newItems = state.items.filter((i) => i.id !== id);
    const newTotal = newItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    return { items: newItems, total: newTotal };
  }),
  updateQuantity: (id: number, delta: number) => set((state) => {
    const newItems = state.items.map((i) => {
      if (i.id === id) {
        const newQuantity = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQuantity };
      }
      return i;
    });
    const newTotal = newItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    return { items: newItems, total: newTotal };
  }),
  clearCart: () => set({ items: [], total: 0 }),
}));
