export const STAFF_PIN = '1234';
export const BODEGA_PIN = '9999';

export interface Insumo {
  id: string;
  name: string;
  unit: string;
}

export const INSUMOS: Insumo[] = [
  { id: 'guantes-latex', name: 'Guantes de látex', unit: 'caja' },
  { id: 'mascarillas-quirurgicas', name: 'Mascarillas quirúrgicas', unit: 'caja' },
  { id: 'jeringas-5ml', name: 'Jeringas 5ml', unit: 'caja' },
  { id: 'gasas-esteriles', name: 'Gasas estériles 10×10', unit: 'paquete' },
  { id: 'alcohol-isopropilico', name: 'Alcohol isopropílico 500ml', unit: 'frasco' },
  { id: 'vendas-elasticas', name: 'Vendas elásticas 10cm', unit: 'unidad' },
];
