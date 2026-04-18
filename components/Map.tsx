import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Lead, SearchParams } from '../types';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom purple icon
const purpleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  leads: Lead[];
  center?: [number, number];
  searchParams?: SearchParams | null;
}

const MapUpdater: React.FC<{ center: [number, number], leads: Lead[], polygonCoords: any[] | null, fallbackCircle: [number, number] | null }> = ({ center, leads, polygonCoords, fallbackCircle }) => {
  const map = useMap();
  
  useEffect(() => {
    // Filter out invalid leads
    const validLeads = leads.filter(l => {
      const lat = Number(l.lat);
      const lng = Number(l.lng);
      const isValidNumber = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
      const isWithinMexico = lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86;
      return isValidNumber && isWithinMexico;
    });

    let targetBounds: L.LatLngBounds | null = null;

    if (polygonCoords && polygonCoords.length > 0) {
      try {
        targetBounds = L.polygon(polygonCoords as any).getBounds();
      } catch (e) {
        console.error("Error calculating polygon bounds", e);
      }
    } else if (fallbackCircle) {
      targetBounds = L.latLng(fallbackCircle[0], fallbackCircle[1]).toBounds(8000);
    }

    if (validLeads.length > 0) {
      // If we have targetBounds (from polygon or circle), filter leads that are roughly within or near those bounds
      // to avoid zooming out too much if a lead is far away.
      let leadsToFit = validLeads;
      
      if (targetBounds) {
        // Expand bounds slightly to include leads just outside the border
        const expandedBounds = targetBounds.pad(0.5); 
        const leadsInBounds = validLeads.filter(l => expandedBounds.contains([Number(l.lat), Number(l.lng)]));
        if (leadsInBounds.length > 0) {
          leadsToFit = leadsInBounds;
        }
      }

      const leadsBounds = L.latLngBounds(leadsToFit.map(l => [Number(l.lat), Number(l.lng)]));
      
      // If we have a polygon, we might want to ensure the polygon is also visible
      if (targetBounds) {
        leadsBounds.extend(targetBounds);
      }

      if (leadsBounds.isValid()) {
        map.fitBounds(leadsBounds, { padding: [50, 50], maxZoom: 16 });
      }
    } else if (targetBounds && targetBounds.isValid()) {
      map.fitBounds(targetBounds, { padding: [20, 20] });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [center, leads, map, polygonCoords, fallbackCircle]);

  return null;
};

export const Map: React.FC<MapProps> = ({ leads, center = [19.4326, -99.1332], searchParams }) => {
  const [polygonCoords, setPolygonCoords] = useState<any[] | null>(null);
  const [fallbackCircle, setFallbackCircle] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (searchParams?.municipality && searchParams?.state) {
      const fetchPolygon = async () => {
        try {
          const query = `${searchParams.municipality}, ${searchParams.state}, Mexico`;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&polygon_geojson=1&format=json`);
          const data = await res.json();
          if (data && data.length > 0) {
            // Find the best match that has a polygon
            const match = data.find((d: any) => d.geojson && (d.geojson.type === 'Polygon' || d.geojson.type === 'MultiPolygon'));
            if (match) {
              const geojson = match.geojson;
              if (geojson.type === 'Polygon') {
                const coords = geojson.coordinates[0].map((c: number[]) => [c[1], c[0]]);
                setPolygonCoords([coords]);
              } else if (geojson.type === 'MultiPolygon') {
                 const multiCoords = geojson.coordinates.map((poly: any) => 
                   poly[0].map((c: number[]) => [c[1], c[0]])
                 );
                 setPolygonCoords(multiCoords);
              }
              setFallbackCircle(null);
            } else {
              setPolygonCoords(null);
              // Use the first result's lat/lon for the fallback circle
              setFallbackCircle([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            }
          } else {
            setPolygonCoords(null);
            setFallbackCircle(null);
          }
        } catch (e) {
          console.error("Failed to fetch polygon", e);
          setPolygonCoords(null);
          setFallbackCircle(null);
        }
      };
      fetchPolygon();
    } else {
      setPolygonCoords(null);
      setFallbackCircle(null);
    }
  }, [searchParams]);

  return (
    <div className="h-[650px] w-full z-0 relative">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '650px', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <MapUpdater center={center} leads={leads} polygonCoords={polygonCoords} fallbackCircle={fallbackCircle} />
        
        {polygonCoords && (
          <Polygon 
            positions={polygonCoords} 
            pathOptions={{ color: '#6A0DAD', fillColor: '#6A0DAD', fillOpacity: 0.1, weight: 2 }} 
          />
        )}

        {!polygonCoords && fallbackCircle && (
          <Circle 
            center={fallbackCircle} 
            radius={8000} 
            pathOptions={{ color: '#6A0DAD', fillColor: '#6A0DAD', fillOpacity: 0.1, weight: 2, dashArray: '5, 10' }} 
          />
        )}

        {leads.map((lead) => {
          const lat = Number(lead.lat);
          const lng = Number(lead.lng);
          const isValidCoord = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
          const isWithinMexico = lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86;
          
          return (isValidCoord && isWithinMexico) ? (
            <Marker key={lead.id} position={[lat, lng]} icon={purpleIcon}>
              <Popup className="custom-popup">
                <div className="p-1">
                  <h4 className="font-bold text-[#6A0DAD] text-sm mb-1">{lead.name}</h4>
                  <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {lead.phone}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2">{lead.street}, {lead.neighborhood}</p>
                </div>
              </Popup>
            </Marker>
          ) : null;
        })}
      </MapContainer>
    </div>
  );
};
