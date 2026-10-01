import { DossierLimitDecision } from '@/components/dossier-limit-decision';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DossierLimitDecision id={id} />;
}
