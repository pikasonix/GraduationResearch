import ShowcaseSection from "./_ShowcaseSection";
import RoutingPage from "./routing/page";

export const revalidate = 300; // Revalidate this page every 5 minutes

export default async function Home() {

  return (
    <main className="min-h-screen bg-[#F8F7FA]">
      {/* <ShowcaseSection /> */}
      <RoutingPage />
    </main>
  );
}