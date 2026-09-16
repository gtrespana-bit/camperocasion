import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductCard, { ProductCardData } from '../src/components/ProductCard';

// Mock del componente LocalLink
jest.mock('../src/components/LocalLink', () => {
  function MockLocalLink({ children, ...props }: { children: React.ReactNode; [key: string]: any }) {
    return <a {...props}>{children}</a>;
  }
  MockLocalLink.displayName = 'MockLocalLink'
  return MockLocalLink
});

// La config de Jest mapea next/image a __mocks__/next/image.js, que no existe
// en el repo. Añadimos un mock inline para que el test sea autosuficiente.
jest.mock('next/image', () => {
  function MockImage(props: any) {
    return <img {...props} />;
  }
  MockImage.displayName = 'MockImage'
  return MockImage;
});

// ProductCard ahora usa `useTranslations` de next-intl (antes usaba el hook
// `useLocalizedMessages`, que importaba el diccionario estáticamente).
// La config de Jest no transforma el ESM de next-intl, así que mockeamos el
// hook devolviendo las traducciones reales de las claves que usa ProductCard.
const TRANSLATIONS: Record<string, string> = {
  'productCard.featured': 'Destacado',
  'productCard.boost': 'Boost',
  'productCard.verified': 'Verificado',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => TRANSLATIONS[key] ?? key,
}));

describe('ProductCard', () => {
  const mockProduct: ProductCardData = {
    id: '1',
    titulo: 'Producto de prueba',
    precio_usd: 100,
    imagen_url: 'https://example.com/image.jpg',
    ubicacion_ciudad: 'Caracas',
    ubicacion_estado: 'Distrito Capital',
    estado: 'Nuevo',
    boosteado_en: null,
    destacado: false,
    destacado_hasta: null,
    vendedor_verificado: false
  };

  it('renderiza correctamente la información básica del producto', () => {
    render(<ProductCard p={mockProduct} />);
    
    expect(screen.getByText('Producto de prueba')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('Nuevo · Caracas')).toBeInTheDocument();
  });

  it('muestra imagen de placeholder cuando no hay imagen_url', () => {
    const productWithoutImage = { ...mockProduct, imagen_url: null };
    render(<ProductCard p={productWithoutImage} />);
    
    const image = screen.getByAltText('Producto de prueba');
    expect(image).toHaveAttribute('src', '/placeholder-product.webp');
  });

  it('muestra badge de producto destacado', () => {
    const featuredProduct = { ...mockProduct, destacado: true };
    render(<ProductCard p={featuredProduct} isFeatured={true} />);
    
    expect(screen.getByText('⭐ Destacado')).toBeInTheDocument();
  });

  it('muestra badge de producto boosteado', () => {
    const boostedProduct = { ...mockProduct, boosteado_en: '2023-01-01T00:00:00Z' };
    render(<ProductCard p={boostedProduct} isPromoted={true} />);
    
    expect(screen.getByText('⚡ Boost')).toBeInTheDocument();
  });

  it('muestra badge de vendedor verificado', () => {
    const verifiedSellerProduct = { ...mockProduct, vendedor_verificado: true };
    render(<ProductCard p={verifiedSellerProduct} />);
    
    expect(screen.getByText('Verificado')).toBeInTheDocument();
  });
});
