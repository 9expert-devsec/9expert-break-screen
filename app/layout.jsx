import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "9Expert Break Screen — หน้าจอพักเบรก",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body data-layout="standard">
        {/* qrcode-generator (self-hosted). Must define the global `qrcode`
            symbol before the client engine's qrDataUrl() runs. */}
        <Script src="/qrcode.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
