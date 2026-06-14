import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MarketingShell } from "@/components/MarketingShell";
import { useSession } from "@/lib/auth";
import { registerMerchInterest } from "@/lib/merch-interest.functions";

import toolBagImg from "@/assets/merch/tool-bag.jpg";
import hoodieImg from "@/assets/merch/hoodie.jpg";
import hiVisTeeImg from "@/assets/merch/hi-vis-tee.jpg";
import steelMugImg from "@/assets/merch/steel-mug.jpg";
import truckerCapImg from "@/assets/merch/trucker-cap.jpg";
import workJacketImg from "@/assets/merch/work-jacket.jpg";

type Category = "apparel" | "bags" | "caps" | "drinkware";

type Product = {
  slug: string;
  name: string;
  spec: string;
  price: number;
  category: Category;
  image: string;
};

const PRODUCTS: Product[] = [
  { slug: "hd-tech-tote", name: "HD Tech Tool Bag", spec: "Heavy canvas / lime webbing", price: 65, category: "bags", image: toolBagImg },
  { slug: "heavyweight-hoodie", name: "Heavyweight Hoodie", spec: "400gsm brushed cotton", price: 45, category: "apparel", image: hoodieImg },
  { slug: "hi-vis-tee", name: "Hi-Vis Performance Tee", spec: "Breathable mesh, EN-rated colour", price: 24, category: "apparel", image: hiVisTeeImg },
  { slug: "steel-mug", name: "Insulated Steel Mug", spec: "Double-walled 500ml", price: 18, category: "drinkware", image: steelMugImg },
  { slug: "trucker-cap", name: "Operator Trucker Cap", spec: "Mesh back / embroidered Q.", price: 22, category: "caps", image: truckerCapImg },
  { slug: "work-jacket", name: "Site Work Jacket", spec: "Reinforced shoulders / fleece-lined", price: 89, category: "apparel", image: workJacketImg },
];

const CATEGORIES: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "All products" },
  { key: "apparel", label: "Apparel" },
  { key: "bags", label: "Bags" },
  { key: "caps", label: "Caps" },
  { key: "drinkware", label: "Drinkware" },
];

const TITLE = "Quottr Gear — workwear & kit for UK trades";
const DESCRIPTION =
  "Branded workwear and jobsite essentials from Quottr. Tool bags, hoodies, hi-vis tees, caps, mugs and jackets — built for the trades.";

export const Route = createFileRoute("/merch")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
  }),
  component: MerchPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);

function MerchPage() {
  const { session } = useSession();
  const isMember = !!session;
  const [cat, setCat] = useState<Category | "all">("all");
  const [notify, setNotify] = useState<Product | null>(null);

  const visible = useMemo(
    () => (cat === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat)),
    [cat],
  );

  return (
    <MarketingShell>
      <section className="bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-16">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
            <div>
              <span className="text-lime font-bold tracking-[0.2em] text-[11px] uppercase mb-3 block">
                Professional Grade
              </span>
              <h1
                className="leading-[0.85] uppercase"
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3.5rem, 10vw, 6.5rem)" }}
              >
                Quottr. <span className="text-lime">Gear</span>
              </h1>
              <p className="mt-3 text-sm text-white/60 max-w-md">
                Workwear and jobsite kit built for UK trades. Not influencer merch — actual gear you'd
                wear to a job.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-sm flex items-center gap-3 max-w-sm">
              {isMember ? (
                <>
                  <div className="bg-lime text-ink font-bold px-2 py-1 text-[10px] rounded-sm uppercase tracking-wider">
                    Member
                  </div>
                  <p className="text-xs text-white/70 leading-snug">
                    Your <span className="text-white font-semibold">15% Quottr member discount</span> will
                    apply automatically once the shop is live.
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-lime text-ink font-bold px-2 py-1 text-[10px] rounded-sm uppercase tracking-wider">
                    -15%
                  </div>
                  <p className="text-xs text-white/70 leading-snug">
                    Quottr members get 15% off everything.{" "}
                    <a href="/auth" className="text-lime hover:underline">Sign in</a> to lock it in.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Filter + trust strip */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-6">
            <div
              className="flex gap-6 md:gap-8 overflow-x-auto no-scrollbar pb-2 w-full md:w-auto tracking-wide"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {CATEGORIES.map((c) => {
                const active = cat === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCat(c.key)}
                    className={`text-xl whitespace-nowrap pb-1 transition-colors ${
                      active ? "text-lime border-b-2 border-lime" : "text-white/40 hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div className="bg-lime text-ink px-4 py-2 text-[10px] font-bold tracking-tight uppercase rounded-full flex items-center gap-2 whitespace-nowrap">
              <span>Free UK shipping over £50</span>
              <span className="w-1 h-1 bg-ink rounded-full" />
              <span>Next-day dispatch</span>
            </div>
          </div>

          {/* Grid */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {visible.map((p) => {
              const member = +(p.price * 0.85).toFixed(2);
              return (
                <article key={p.slug} className="group">
                  <div className="aspect-square bg-neutral-900 border border-white/10 relative overflow-hidden">
                    <img
                      src={p.image}
                      alt={`${p.name} — Quottr branded merch`}
                      width={1024}
                      height={1024}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="absolute top-3 left-3 bg-lime text-ink text-[10px] font-black px-2 py-1 uppercase tracking-wider">
                      {isMember ? "Member price" : "-15% members"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotify(p)}
                      className="absolute bottom-0 left-0 right-0 bg-lime text-ink py-4 text-xl translate-y-full group-hover:translate-y-0 transition-transform"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      aria-label={`Notify me when ${p.name} is available`}
                    >
                      Notify me when live
                    </button>
                  </div>
                  <div className="mt-4 flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3
                        className="text-2xl tracking-wide uppercase leading-none"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-white/50 mt-1">{p.spec}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-white/40 line-through tabular-nums">{fmt(p.price)}</p>
                      <p
                        className="text-xl text-lime tabular-nums"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {fmt(member)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Custom fleet branding */}
          <div className="mt-20 bg-white/5 border border-white/10 p-10 md:p-12 text-center rounded-sm">
            <h2
              className="text-3xl md:text-4xl uppercase"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Custom fleet branding
            </h2>
            <p className="text-white/60 max-w-xl mx-auto mt-3 mb-6 text-sm">
              Need 10+ items for your team with your own logo alongside the Quottr mark? We do bulk
              discounts and custom embroidery.
            </p>
            <a
              href="mailto:hello@quottr.co.uk?subject=Quottr%20Gear%20%E2%80%94%20custom%20fleet%20enquiry"
              className="inline-block border border-lime text-lime px-8 py-3 text-xl hover:bg-lime hover:text-ink transition-colors"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Enquire about custom orders
            </a>
          </div>

          <p className="mt-10 text-[11px] text-white/35 text-center uppercase tracking-widest">
            Shop launching soon · drop your email above and we'll let you know
          </p>
        </div>
      </section>

      <NotifySheet
        product={notify}
        onClose={() => setNotify(null)}
      />
    </MarketingShell>
  );
}

function NotifySheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const submit = useServerFn(registerMerchInterest);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!product) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: { email: email.trim(), product_slug: product.slug } });
      toast.success("Got it — we'll email you when it drops.");
      setEmail("");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't save your email";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0a0a0a] border border-white/10 text-white rounded-sm p-6"
      >
        <p className="text-lime font-bold tracking-widest text-[10px] uppercase">
          Notify me · {product.name}
        </p>
        <h2
          className="text-3xl uppercase mt-1"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          Get first dibs
        </h2>
        <p className="text-white/60 text-sm mt-2">
          We'll email you the second {product.name} is live. No spam — one email, that's it.
        </p>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-4 w-full bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-white/40 rounded-sm outline-none focus:border-lime"
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-lime text-ink py-3 text-lg uppercase disabled:opacity-60"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {busy ? "Saving…" : "Notify me"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-white/70 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
