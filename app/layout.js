import "./globals.css";

export const metadata = {
  title: "Repo Onboarding Assistant — Powered by HAL",
  description: "Understand any codebase in under 2 minutes. HAL reads your entire repo and generates a README, architecture diagram, and plain-English walkthrough.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Liquid Glass ambient background */}
        <div className="aurora">
          <div className="blob-3" />
        </div>
        <div className="grain" />
        <main className="content-layer">{children}</main>
      </body>
    </html>
  );
}
