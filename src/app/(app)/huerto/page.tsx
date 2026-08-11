import type { Metadata } from "next";
import HuertoView from "./components/HuertoView";
import { getGardenDataAction } from "./actions";
import { getCurrentMonthInMadrid } from "./lib/madridMonth";

export const metadata: Metadata = { title: "Huerto | SolarHub" };

export default async function HuertoPage() {
  const { plants, beds, plantBeds } = await getGardenDataAction();
  const initialMonth = getCurrentMonthInMadrid();

  return (
    <HuertoView
      plants={plants}
      beds={beds}
      plantBeds={plantBeds}
      initialMonth={initialMonth}
    />
  );
}
