import './globals.css';

export const metadata = {
  title: 'Call Center AI Assistant',
  description: 'AI assistant for call center agents — grounded answers only',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
