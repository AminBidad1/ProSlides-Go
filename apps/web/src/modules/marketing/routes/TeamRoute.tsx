import { useLayoutEffect } from "react";

import alirezaRezaei from "../../../assets/avatars/AlirezaRezaei.jpg";
import amiraliFakhari from "../../../assets/avatars/AmiraliFakhari.jpg";
import aminBidad from "../../../assets/avatars/AminBidad.jpg";
import HesamAzmoun from "../../../assets/avatars/HesamAzmoun.jpg";
import KianJanbozorgi from "../../../assets/avatars/KianJanbozorgi.jpg";
import SimaKazemi from "../../../assets/avatars/SimaKazemi.jpg";
import ZahraKefayati from "../../../assets/avatars/ZahraKefayati.jpg";
import Seo from "../../../shared/ui/Seo.tsx";
import SiteHeader from "../../../shared/ui/SiteHeader.tsx";

type TeamMember = {
  name: string;
  role: string;
  avatar: string;
};

const team: TeamMember[] = [
  {
    name: "امین بیداد",
    role: "مهندسی بک‌اند",
    avatar: aminBidad,
  },
  {
    name: "امیرعلی فخاری",
    role: "مهندسی بک‌اند",
    avatar: amiraliFakhari,
  },
  {
    name: "علیرضا رضایی",
    role: "مهندسی فرانت‌اند",
    avatar: alirezaRezaei,
  },
  {
    name: "حسام آزمون",
    role: "مهندسی فرانت‌اند",
    avatar: HesamAzmoun,
  },
  {
    name: "کیان جان بزرگی",
    role: "مهندسی فرانت‌اند",
    avatar: KianJanbozorgi,
  },
  {
    name: "سیما کاظمی",
    role: "مهندسی فرانت‌اند",
    avatar: SimaKazemi,
  },
  {
    name: "زهرا کفایتی",
    role: "مهندسی فرانت‌اند",
    avatar: ZahraKefayati,
  },
];

export default function TeamRoute() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-content" dir="rtl">
      <Seo
        title="تیم ما | پرو اسلایدز"
        description="با اعضای تیم ProSlides و نقش آن‌ها در توسعه محصول آشنا شوید."
        canonical="https://proslides.ir/team"
      />

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div
          className="landing-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem]"
          aria-hidden="true"
        />

        <header className="text-center">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-content sm:text-5xl">
            تیم ProSlides
          </h1>
        </header>

        <ul
          className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-x-4 gap-y-9 sm:mt-14 sm:gap-x-6 sm:gap-y-11"
          aria-label="اعضای تیم ProSlides"
        >
          {team.map((member) => (
            <li
              key={member.name}
              className="basis-[calc(50%-0.5rem)] sm:basis-[calc(33.333%-1rem)] lg:basis-[calc(25%-1.125rem)]"
            >
              <article className="group text-center">
                <div className="aspect-square overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-sm transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:border-brand-border group-hover:shadow-panel motion-reduce:transform-none">
                  <img
                    src={member.avatar}
                    alt={"تصویر " + member.name}
                    width={480}
                    height={480}
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transform-none"
                  />
                </div>

                <div className="px-1 pt-4">
                  <h2 className="text-base font-black text-content sm:text-lg">
                    {member.name}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-content-muted sm:text-sm">
                    {member.role}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
