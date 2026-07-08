"use client";

import { useEffect } from "react";

type StartingPriceItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

type StartingPriceLabelsProps = {
  items: StartingPriceItem[];
};

const PRICE_CLASS = "imenu-starting-price-label";
const PRICE_PATTERN = /R\$\s*\d[\d.]*(?:,\d{2}|\.\d{2})/;

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");

const hasExactText = (element: Element, expected: string) =>
  normalize(element.textContent) === normalize(expected);

const getImagePath = (value: string | null | undefined) => {
  if (!value) return "";

  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return value;
  }
};

const findVisiblePriceElement = (container: Element) => {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>("span, p, div"),
  ).filter((element) => {
    const text = element.textContent ?? "";
    const style = window.getComputedStyle(element);

    return (
      PRICE_PATTERN.test(text) &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      !element.classList.contains("line-through") &&
      !element.closest(".line-through")
    );
  });

  // When a promotion exists, prefer its green current-price span instead of
  // the parent that also contains the crossed-out original price.
  return (
    candidates.find((element) => element.classList.contains("text-green")) ??
    candidates.find(
      (element) =>
        !Array.from(element.children).some((child) =>
          PRICE_PATTERN.test(child.textContent ?? ""),
        ),
    ) ??
    candidates[0] ??
    null
  );
};

export default function StartingPriceLabels({
  items,
}: StartingPriceLabelsProps) {
  useEffect(() => {
    const clearLabels = () => {
      document
        .querySelectorAll<HTMLElement>(`.${PRICE_CLASS}`)
        .forEach((element) => element.classList.remove(PRICE_CLASS));
    };

    clearLabels();
    if (items.length === 0) return clearLabels;

    let animationFrame: number | null = null;

    const markPrice = (container: Element | null) => {
      if (!container) return;
      const price = findVisiblePriceElement(container);
      price?.classList.add(PRICE_CLASS);
    };

    const applyLabels = () => {
      clearLabels();

      for (const item of items) {
        const expectedImagePath = getImagePath(item.imageUrl);

        // Menu cards, search results and cart upsell cards all use a
        // button containing the product name/image and its displayed price.
        document
          .querySelectorAll<HTMLButtonElement>("button")
          .forEach((button) => {
            const exactNameElement = Array.from(
              button.querySelectorAll("p, h1, h2, h3, h4, span"),
            ).find((element) => hasExactText(element, item.name));

            if (!exactNameElement) return;

            const images = Array.from(
              button.querySelectorAll<HTMLImageElement>("img"),
            );
            const imageMatches =
              !expectedImagePath ||
              images.length === 0 ||
              images.some(
                (image) =>
                  getImagePath(image.currentSrc || image.src) ===
                    expectedImagePath ||
                  normalize(image.alt) === normalize(item.name),
              );

            if (imageMatches) markPrice(button);
          });

        // Product details modal: the title and price live in the same
        // header block rather than inside a product-card button.
        document.querySelectorAll("h1").forEach((heading) => {
          if (!hasExactText(heading, item.name)) return;
          markPrice(heading.parentElement);
        });
      }
    };

    const scheduleApply = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        applyLabels();
      });
    };

    scheduleApply();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      clearLabels();
    };
  }, [items]);

  return (
    <style>{`
            .${PRICE_CLASS}::before {
                content: "A partir de ";
            }
        `}</style>
  );
}
