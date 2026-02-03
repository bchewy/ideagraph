import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">IdeaGraph</h1>
      <p className="text-lg text-muted-foreground">
        Extract ideas from PDFs and explore them as a knowledge graph.
      </p>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Get Started</CardTitle>
          <CardDescription>
            Create a project and upload PDFs to begin extracting ideas.
          </CardDescription>
        </CardHeader>
      </Card>
      <Button>Create Project</Button>
    </div>
  );
}
