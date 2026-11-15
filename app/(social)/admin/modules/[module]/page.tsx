import type { Metadata } from "next";
import { isModuleName, MODULE_LABEL } from "../labels";
import { ModuleScreen } from "./screen";

type Props = { params: Promise<{ module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  return { title: `${isModuleName(module) ? MODULE_LABEL[module] : "Module"} · Ruxstar console`, robots: { index: false } };
}

export default async function ModulePage({ params }: Props) {
  return <ModuleScreen module={(await params).module} />;
}
