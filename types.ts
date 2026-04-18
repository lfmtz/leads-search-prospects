
export interface Lead {
  id: string;
  name: string;
  phone: string;
  street: string;
  neighborhood: string;
  zipCode: string;
  municipality: string;
  website: string;
  socialMedia?: string;
  rating: string;
  schedule: string;
  lat: number;
  lng: number;
  category: string;
  mapsUrl?: string;
}

export interface SearchParams {
  state: string;
  municipality: string;
  business_type: string;
}
