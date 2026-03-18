import { create } from 'zustand';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  isMisc?: boolean;
}

export interface Discount {
  type: 'fixed';
  value: number;
}

export interface HeldCart {
  id: string;
  timestamp: string;
  items: CartItem[];
  customerName: string | null;
  customerId: number | null;
  discount: Discount | null;
  total: number;
}

interface CartStore {
  items: CartItem[];
  total: number;
  discount: Discount | null;
  heldCarts: HeldCart[];

  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, delta: number) => void;
  clearCart: () => void;
  setDiscount: (discount: Discount | null) => void;
  holdCart: (customerName: string | null, customerId: number | null) => void;
  resumeCart: (id: string) => HeldCart | null;
  deleteHeldCart: (id: string) => void;
  addMiscItem: (name: string, price: number) => void;
  resetCheckout: () => void;
}

function calcTotal(items: CartItem[]) {
  return items.reduce((acc, i) => acc + i.price * i.quantity, 0);
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  total: 0,
  discount: null,
  heldCarts: [],

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
    return { items: newItems, total: calcTotal(newItems) };
  }),

  removeItem: (id) => set((state) => {
    const newItems = state.items.filter((i) => i.id !== id);
    return { items: newItems, total: calcTotal(newItems) };
  }),

  updateQuantity: (id, delta) => set((state) => {
    const newItems = state.items.map((i) => {
      if (i.id === id) {
        return { ...i, quantity: Math.max(1, i.quantity + delta) };
      }
      return i;
    });
    return { items: newItems, total: calcTotal(newItems) };
  }),

  clearCart: () => set({ items: [], total: 0 }),

  setDiscount: (discount) => set({ discount }),

  holdCart: (customerName, customerId) => set((state) => {
    if (state.items.length === 0) return state;
    const held: HeldCart = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      items: [...state.items],
      customerName,
      customerId,
      discount: state.discount,
      total: state.total,
    };
    return {
      heldCarts: [...state.heldCarts, held],
      items: [],
      total: 0,
      discount: null,
    };
  }),

  resumeCart: (id) => {
    const state = get();
    const held = state.heldCarts.find((c) => c.id === id);
    if (!held) return null;
    set({
      items: held.items,
      total: held.total,
      discount: held.discount,
      heldCarts: state.heldCarts.filter((c) => c.id !== id),
    });
    return held;
  },

  deleteHeldCart: (id) => set((state) => ({
    heldCarts: state.heldCarts.filter((c) => c.id !== id),
  })),

  addMiscItem: (name, price) => set((state) => {
    const miscItem: CartItem = {
      id: -Date.now(),
      name: `(Misc) ${name}`,
      price,
      quantity: 1,
      isMisc: true,
    };
    const newItems = [...state.items, miscItem];
    return { items: newItems, total: calcTotal(newItems) };
  }),

  resetCheckout: () => set({ discount: null }),
}));
