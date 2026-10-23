import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">این صفحه در محصول نیست</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is not part of the product.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">بازگشت</Link>
      </div>
    </main>
  );
}
