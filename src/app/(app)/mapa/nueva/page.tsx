import type { Metadata } from "next";
import { getStickersAction, getCountriesAction } from "../actions";
import NewPinForm from "./components/NewPinForm";

export const metadata: Metadata = { title: "Nueva pegatina | SolarHub" };

export default async function NuevaPegatina() {
  const [stickers, countries] = await Promise.all([
    getStickersAction(),
    getCountriesAction(),
  ]);

  return <NewPinForm stickers={stickers} countries={countries} />;
}
