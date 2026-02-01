import "./globals.css";

export const metadata = {
  title: "Ralph Village",
  description: "Cozy village prototype with Phaser and Next.js.",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}

