
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchParams } from "../types";

const API_KEY = process.env.API_KEY || "";

export const exploreCategories = async (state: string, municipality: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Enumera 8 giros de negocios comunes o industrias principales (ej. Talleres Mecánicos, Transportistas, Vidrieras, Logística, Refaccionarias, Flotillas) que operan en el municipio/alcaldía "${municipality}", estado de "${state}", México.
    Devuelve SOLO una lista en formato JSON de strings. Ejemplo: ["Talleres Mecánicos", "Transportistas", "Restaurantes"]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Error exploring categories:", error);
    return ["Talleres Mecánicos", "Transportistas", "Logística", "Refaccionarias", "Construcción", "Comercio al por mayor"];
  }
};

export const fetchMarketIntelligence = async (state: string, municipality: string): Promise<{ total: number, categories: {name: string, count: number}[] }> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Actúa como un analista de mercado. Realiza una estimación rápida y realista de la cantidad de negocios comerciales registrados en Google Maps para el municipio/alcaldía "${municipality}", estado de "${state}", México.
    
    Devuelve un JSON con:
    1. "total": un número entero con el total estimado de negocios en todo el municipio.
    2. "categories": un arreglo de objetos con "name" (el nombre del giro) y "count" (número estimado de negocios de ese giro). 
    Incluye giros variados como: Hospitales, Restaurantes, Hoteles, Talleres Mecánicos, Escuelas, Logística, Tiendas de Conveniencia, Seguros, Papelerías, etc.
    
    Asegúrate de que la suma de los "count" en las categorías no exceda el "total".
    DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN JSON VÁLIDO.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.INTEGER },
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  count: { type: Type.INTEGER }
                },
                required: ["name", "count"]
              }
            }
          },
          required: ["total", "categories"]
        }
      },
    });

    const text = response.text || "{}";
    
    try {
      const data = JSON.parse(text);
      if (!data.categories) {
        return { total: 0, categories: [] };
      }
      // Sort categories descending
      data.categories.sort((a: any, b: any) => b.count - a.count);
      return { total: data.total, categories: data.categories };
    } catch (e) {
      console.error("Error parsing market intelligence JSON:", e);
      return { total: 0, categories: [] };
    }
  } catch (error) {
    console.error("Error fetching market intelligence:", error);
    throw error;
  }
};

export const fetchLeads = async (params: SearchParams, currentLeadsCount: number = 0): Promise<Lead[]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Actúa como un motor de extracción con scroll infinito agresivo en Google Maps. Encuentra un bloque de 50 negocios reales para la búsqueda: "${params.business_type}" en el municipio/alcaldía "${params.municipality}", estado de "${params.state}", México.
    IMPORTANTE: Ya tengo ${currentLeadsCount} resultados en mi base de datos. Omite los primeros ${currentLeadsCount} y haz un scroll profundo para traerme los SIGUIENTES 50 negocios diferentes.
    Asegúrate de realizar un barrido total de categorías (hoteles, restaurantes, talleres, escuelas, hospitales, tiendas, etc.) si la búsqueda es general.
    Extrae la siguiente información para cada negocio:
    - Nombre
    - Teléfono
    - Calle y Número (ej. "Av. Insurgentes Sur 123")
    - Colonia (ej. "Roma Norte")
    - Código Postal (ej. "06700")
    - Municipio/Alcaldía (ej. "Cuauhtémoc")
    - Sitio Web (Prioridad 1: Busca el botón oficial de "Sitio Web". Si tiene ponlo aquí, si no usa "N/A")
    - Redes Sociales (Prioridad 2: Si el negocio no tiene sitio web propio pero tiene enlace a Facebook, Instagram o LinkedIn, recupéralo y ponlo aquí. Si no hay usa "N/A")
    - Calificación (Estrellas, ej. "4.5", si no tiene "N/A")
    - Horarios (ej. "L-V 9:00-18:00", si no tiene "N/A")
    - Latitud (coordenada numérica, ej. 19.4326)
    - Longitud (coordenada numérica, ej. -99.1332)
    - Categoría (ej. "Transporte", "Logística", "Seguros", "Hotel", "Restaurante")
    - URL de Google Maps (ej. https://maps.google.com/?q=lat,lng o buscando el nombre exacto)
    
    Devuelve EXACTAMENTE 50 resultados reales si es posible. Si un dato no existe, usa "N/A".
    DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN ARREGLO JSON VÁLIDO. NO INCLUYAS TEXTO ADICIONAL, NI EXPLICACIONES, NI FORMATO MARKDOWN.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              phone: { type: Type.STRING },
              street: { type: Type.STRING },
              neighborhood: { type: Type.STRING },
              zipCode: { type: Type.STRING },
              municipality: { type: Type.STRING },
              website: { type: Type.STRING },
              socialMedia: { type: Type.STRING },
              rating: { type: Type.STRING },
              schedule: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              category: { type: Type.STRING },
              mapsUrl: { type: Type.STRING }
            },
            required: ["name", "phone", "street", "neighborhood", "zipCode", "municipality", "website", "socialMedia", "rating", "schedule", "lat", "lng", "category", "mapsUrl"]
          }
        }
      },
    });

    const text = response.text || "[]";
    
    try {
      const leads: any[] = JSON.parse(text);
      return leads.map((l, index) => ({
        id: `${Date.now()}-${index}`,
        name: l.name || "N/A",
        phone: l.phone || "N/A",
        street: l.street || "N/A",
        neighborhood: l.neighborhood || "N/A",
        zipCode: l.zipCode || "N/A",
        municipality: l.municipality || "N/A",
        website: l.website || "N/A",
        socialMedia: l.socialMedia || "N/A",
        rating: l.rating || "N/A",
        schedule: l.schedule || "N/A",
        lat: l.lat || 0,
        lng: l.lng || 0,
        category: l.category || "N/A",
        mapsUrl: l.mapsUrl || `https://maps.google.com/?q=${l.lat},${l.lng}`
      }));
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return [];
    }
  } catch (error) {
    console.error("Error fetching leads:", error);
    throw error;
  }
};
