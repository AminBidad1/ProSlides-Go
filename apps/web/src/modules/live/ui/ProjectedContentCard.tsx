import type { LegacyContentSlide } from "../model/serverData.ts";
import { contentProjectionTextClass } from "../model/projectionLayout.ts";
import { LiveMediaImage } from "./LiveMediaImage.tsx";

type ProjectedContentCardProps = {
  content: LegacyContentSlide;
  className?: string;
};

export function ProjectedContentCard({
  content,
  className = "",
}: ProjectedContentCardProps) {
  const title = String(content.title ?? "");
  const text = String(content.content_text ?? "");
  const image = String(content.content_image_url ?? "");
  const hasText = Boolean(text.trim());
  const hasImage = Boolean(image.trim());
  const split = hasText && hasImage;
  const textClass = contentProjectionTextClass(text);

  return (
    <article
      className={`mx-auto flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-[color:var(--live-surface)] p-6 text-center shadow-2xl backdrop-blur sm:p-8 ${className}`}
    >
      {title ? (
        <h1
          className="line-clamp-2 shrink-0 text-3xl font-black leading-tight sm:text-5xl xl:text-6xl"
          dir="auto"
        >
          {title}
        </h1>
      ) : null}

      <div
        className={
          "grid min-h-0 flex-1 items-center gap-5 " +
          (title ? "mt-5 " : "") +
          (split ? "md:grid-cols-2 md:gap-7" : "grid-cols-1")
        }
      >
        {hasText ? (
          <p
            className={`mx-auto max-h-full min-w-0 max-w-4xl overflow-hidden whitespace-pre-wrap text-[color:var(--live-muted)] ${textClass}`}
            dir="auto"
          >
            {text}
          </p>
        ) : null}

        {hasImage ? (
          <LiveMediaImage
            src={image}
            alt={title ? `تصویر ${title}` : "تصویر محتوای ارائه"}
            className={
              "mx-auto min-h-0 max-w-full rounded-3xl object-contain shadow-2xl " +
              (split
                ? "max-h-[46dvh] md:max-h-[52dvh]"
                : "max-h-[56dvh]")
            }
          />
        ) : null}
      </div>
    </article>
  );
}
