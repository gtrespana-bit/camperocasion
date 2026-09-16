'use client';

import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';

interface LazyImageProps extends ImageProps {
  placeholderSrc?: string;
}

export const LazyImage = ({ 
  src, 
  alt, 
  placeholderSrc,
  ...props 
}: LazyImageProps) => {
  const [imageSrc, setImageSrc] = useState(placeholderSrc || '/placeholder-product.webp');
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = document.createElement('img');
    img.src = src as string;
    
    img.onload = () => {
      setImageSrc(src as string);
      setImageLoaded(true);
    };
    
    img.onerror = () => {
      setImageSrc(placeholderSrc || '/placeholder-product.webp');
    };
  }, [src, placeholderSrc]);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      {...props}
      className={`${props.className || ''} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
    />
  );
};