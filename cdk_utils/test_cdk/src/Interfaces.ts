export type AnimalType = 'Dog' | 'Cat' | 'Yeti';

export type Animal = {
  name: string;
  type: AnimalType;
  weight: number;
  picky_eater: boolean;
};

export type ShelterMessage = {
  Animal: Animal;
  Action: 'Born' | 'Died';
};

export type NotificationMessage = {
  AnimalName: string;
};

export type FoodPurchaseQuery = {
  type: 'superpremium' | 'premium' | 'standard';
  quantity_kg: number;
};

export type FoodPurchaseResponse = {
  price: number;
};
