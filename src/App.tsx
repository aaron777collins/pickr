import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Pickr</CardTitle>
          <CardDescription>
            Curate the best from a folder of photos and videos
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">WIP scaffold</p>
          <Button onClick={() => toast("Toast works!")}>
            Test Toast
          </Button>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}

export default App;
