import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      // Push toasts below the status bar (notch) and the page header so the
      // text never overlaps the screen title.
      offset="calc(env(safe-area-inset-top, 0px) + 72px)"
      mobileOffset="calc(env(safe-area-inset-top, 0px) + 72px)"
      toastOptions={{
        classNames: {
          toast:
            "!bg-white !text-[#111827] !border !border-gray-100 !shadow-[0_8px_30px_rgba(0,0,0,0.12)] !rounded-2xl !gap-3 !py-3.5 !px-4",
          title: "!text-[14px] !font-semibold !leading-snug",
          description: "!text-[13px] !text-gray-500",
          icon: "!mt-0.5",
        },
      }}
      className="toaster group"
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#111827",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
