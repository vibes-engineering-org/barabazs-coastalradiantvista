import { PROJECT_TITLE } from "~/lib/constants";

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_URL ||
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

  const config = {
    accountAssociation: {
      header: "eyJmaWQiOjg2OTk5OSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDc2ZDUwQjBFMTQ3OWE5QmEyYkQ5MzVGMUU5YTI3QzBjNjQ5QzhDMTIifQ",
      payload: "eyJkb21haW4iOiJiYXJhYmF6cy1jb2FzdGFscmFkaWFudHZpc3RhLnZlcmNlbC5hcHAifQ",
      signature: "MHhhZjBiZjFlNmNjZWE3ZWJlZjhjNmYzZGI5OTBiOGI5MDQwZWI1ODQ4Njg4YWNmOWRiM2IyMTAzOWI2MzZlYTI4Njg4MGQxMzFhNTMyYTY2NDdmNTMwYzQ3MWZlMWJlYmRiMGY5ZmVhOWYzZTZmNzI3Nzc4NWIzZDg3ZWMyOTA1ODUxYw"
    },
    frame: {
      version: "1",
      name: PROJECT_TITLE,
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/og.png`,
      buttonTitle: "Open",
      webhookUrl: `${appUrl}/api/webhook`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#555555",
      primaryCategory: "finance",
      tags: ["defi", "tokens", "burning", "erc20", "batch"]
    },
  };

  return Response.json(config);
}
