import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Bitte geben Sie einen Benutzernamen ein."),
  password: z.string().min(1, "Bitte geben Sie ein Passwort ein."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: () => {
        setLocation("/admin");
      },
      onError: () => {
        toast({
          title: "Fehler beim Anmelden",
          description: "Benutzername oder Passwort ist falsch.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <header className="ll-header">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="text-white font-semibold text-base tracking-wide">
            Stiftung Louisenlund
          </div>
          <div className="text-blue-200 text-xs tracking-widest uppercase mt-0.5">
            Administration Regionalshuttle
          </div>
        </div>
        <div className="ll-accent-bar" />
      </header>

      <div className="flex-1 flex items-center justify-center bg-[#f0f0f0] px-4">
        <div className="bg-white border border-gray-200 shadow-sm w-full max-w-sm">
          <div className="h-1 bg-[#004289]" />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-[#004289] flex items-center justify-center">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-[#004289] text-base">Adminbereich</h1>
                <p className="text-xs text-[#666666]">Bitte melden Sie sich an</p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#333333]">
                        Benutzername
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Benutzername eingeben"
                          autoComplete="username"
                          {...field}
                          data-testid="input-username"
                          className="border-gray-300 focus:border-[#004289] focus:ring-[#004289]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#333333]">
                        Passwort
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Passwort eingeben"
                          autoComplete="current-password"
                          {...field}
                          data-testid="input-password"
                          className="border-gray-300 focus:border-[#004289] focus:ring-[#004289]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-[#004289] hover:bg-[#003070] text-white font-semibold"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "Anmelden..." : "Anmelden"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-xs text-[#666666]">
            © {new Date().getFullYear()} Stiftung Louisenlund · D-24357 Güby
          </p>
        </div>
      </footer>
    </div>
  );
}
