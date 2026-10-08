import Experience from '@/components/experience';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  return (
    <Experience
      path={path}
      localDemo={process.env.LOCAL_DEMO_MODE === 'true' && !process.env.VERCEL}
    />
  );
}
