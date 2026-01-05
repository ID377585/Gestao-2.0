import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SemAcessoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Sem acesso</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Seu usuário não possui permissão (membership ativo) para acessar o painel.
            Peça para um administrador vincular você ao estabelecimento e definir um papel.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Voltar para o login
              </Button>
            </Link>

            <Link href="/" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Ir para a página inicial</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
