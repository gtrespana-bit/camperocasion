import type { Metadata } from 'next'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contacto',
  description: '¿Tienes dudas o sugerencias? Contáctanos',
}

export default function ContactPage() {
  return <ContactForm />
}
