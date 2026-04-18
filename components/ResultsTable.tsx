
import React from 'react';
import { Lead } from '../types';

interface ResultsTableProps {
  leads: Lead[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ leads }) => {
  if (leads.length === 0) return null;

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-[#6A0DAD]">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Nombre del Negocio</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Teléfono</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Categoría</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Sitio Web</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Redes Sociales</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Calle y Núm</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Colonia</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">C.P.</th>
            <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Maps</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-purple-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{lead.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#6A0DAD]">{lead.phone}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                  {lead.category}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {lead.website && lead.website !== 'N/A' ? (
                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline truncate block max-w-[150px]">
                    {lead.website}
                  </a>
                ) : <span className="text-gray-400">N/A</span>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {lead.socialMedia && lead.socialMedia !== 'N/A' ? (
                  <a href={lead.socialMedia.startsWith('http') ? lead.socialMedia : `https://${lead.socialMedia}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline truncate block max-w-[150px]">
                    {lead.socialMedia}
                  </a>
                ) : <span className="text-gray-400">N/A</span>}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={lead.street}>{lead.street}</td>
              <td className="px-6 py-4 text-sm text-gray-600 max-w-[150px] truncate" title={lead.neighborhood}>{lead.neighborhood}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lead.zipCode}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                {lead.mapsUrl ? (
                  <a 
                    href={lead.mapsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 bg-purple-100 text-[#6A0DAD] rounded-full hover:bg-purple-200 transition-colors"
                    title="Abrir en Google Maps"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </a>
                ) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
