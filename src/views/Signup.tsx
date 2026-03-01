'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Bot } from "lucide-react";

const signupSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

const Signup = () => {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: SignupFormValues) {
    setSubmitError(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    // Supabase may require email confirmation depending on project settings
    if (data?.user && !data.session) {
      setEmailSent(true);
      return;
    }

    router.push("/");
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Check your email
            </CardTitle>
            <CardDescription>
              We sent a confirmation link to <strong>{form.getValues("email")}</strong>. Click the link to verify your account, then sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-10 h-10 rounded-lg tofu-gradient flex items-center justify-center mb-2">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Create an account
          </CardTitle>
          <CardDescription>
            Enter your email and password to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitError && (
            <Alert variant="destructive" className="text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign up failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                        {...field}
                        onChange={(e) => {
                          setSubmitError(null);
                          field.onChange(e);
                        }}
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        {...field}
                        onChange={(e) => {
                          setSubmitError(null);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        {...field}
                        onChange={(e) => {
                          setSubmitError(null);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full tofu-gradient text-primary-foreground hover:opacity-90"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </Form>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
