import { useEffect } from "react";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { X } from "lucide-react";

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "تأیید",
  cancelText = "انصراف",
  confirmVariant = "default",
  isLoading = false,
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/50 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
        <Card className="relative bg-gray-50 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                {title}
              </CardTitle>
              {!isLoading && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pb-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              {description}
            </p>
          </CardContent>

          <CardFooter className="flex gap-3 pt-0">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              {cancelText}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  در حال انجام…
                </div>
              ) : (
                confirmText
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export { ConfirmDialog };
