import cors from "cors";
import express, { Request, Response } from "express";
import path from "path";
import { Call, Contract, uint256 } from "starknet";
import { abi } from "./strk-abi";

const app = express();

// Configure CORS
const corsOptions = {
  origin: "*", // Allow all origins
  methods: ["GET", "POST"], // Allow only GET and POST requests
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions)); // Apply CORS to all routes
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "../public")));

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const DONATION_DESTINATION_WALLET =
  "0x046da3ee187b8b0d3716f1c08b0c751f62ce9df30e8513a1c070526cfab12507";
const OPTIONS_DONATION_AMOUNT_STRK = [10, 50, 100];
const STRK_CONTRACT_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const strkContract = new Contract(abi, STRK_CONTRACT_ADDRESS);

function generateHtmlWithMetaTags(
  title: string,
  description: string,
  imageUrl: string,
  amount?: string
): string {
  const baseUrl = "https://buy-me-a-cofee-action-sotoijuan.vercel.app/api/tip";
  const urlToUnfurl = amount ? `${baseUrl}/${amount}` : baseUrl;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Twitter Card data -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@tjelailah">
    <meta name="twitter:creator" content="@tjelailah">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:url" content="${urlToUnfurl}">
    
    <!-- Open Graph data -->
    <meta property="og:title" content="${title}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${urlToUnfurl}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:description" content="${description}">
    
    <!-- Other meta tags -->
    <meta name="description" content="${description}">
    <script>
      // Delay redirect to allow metadata to be processed
      setTimeout(function() {
        document.getElementById('debug').textContent = 'Redirecting now...';
        window.location.href = "https://ethereum-blink-unfurler.vercel.app/?url=" + encodeURIComponent("${urlToUnfurl}");
      }, 5000);  // 5 seconds delay
    </script>
</head>
<body>
    <h1>${title}</h1>
    <p>${description}</p>
    <img src="${imageUrl}" alt="${title}" style="max-width: 300px; height: auto;">
    <p id="debug">Waiting to redirect...</p>
    <p>If you are not redirected automatically, please <a href="https://ethereum-blink-unfurler.vercel.app/?url=${encodeURIComponent(
      urlToUnfurl
    )}">click here</a>.</p>
</body>
</html>
  `;
}

app.get("/api/tip", (req: Request, res: Response) => {
  const title = "Buy Me a Coffee";
  const description =
    "Support me by buying me a coffee using STRK. Choose an amount or enter a custom amount.";
  const imageUrl =
    "https://buy-me-a-cofee-action-sotoijuan.vercel.app/images/buy-me-coffee.png";

  const jsonResponse = {
    title,
    icon: imageUrl,
    description,
    links: {
      actions: [
        ...OPTIONS_DONATION_AMOUNT_STRK.map((amount) => ({
          label: `${amount} STRK`,
          href: `/api/tip?amount=${amount}`,
        })),
        {
          href: `/api/tip?amount={amount}`,
          label: "Custom Amount",
          parameters: [
            {
              name: "amount",
              label: "Enter a custom STRK amount",
            },
          ],
        },
      ],
    },
    isStarknet: true,
  };

  const acceptHeader = req.get("Accept");
  const userAgent = req.get("User-Agent");

  // Check if it's likely to be the Twitter card scraper or a browser
  if (
    (acceptHeader && acceptHeader.includes("text/html")) ||
    (userAgent && userAgent.toLowerCase().includes("twitterbot"))
  ) {
    // If it's a browser or the Twitter scraper, send HTML with meta tags
    res.send(generateHtmlWithMetaTags(title, description, imageUrl));
  } else {
    // For all other cases, send the JSON response
    res.json(jsonResponse);
  }
});

app.get("/api/tip/:amount", (req: Request, res: Response) => {
  const amount = req.params.amount;
  const acceptHeader = req.get("Accept");
  const title = `Tip ${amount} STRK`;
  const description = `Tip ${amount} STRK to support.`;
  const imageUrl = "/images/buy-me-coffee.png";

  if (acceptHeader && acceptHeader.includes("text/html")) {
    // If the request accepts HTML, send the HTML page with meta tags
    res.send(generateHtmlWithMetaTags(title, description, imageUrl, amount));
  } else {
    // Otherwise, send the JSON response as before
    const response = {
      title,
      icon: imageUrl,
      description,
      links: {
        actions: [
          {
            label: "Buy Me a Coffee",
            href: `/api/tip?amount=${amount}`,
          },
        ],
      },
      isStarknet: true,
    };
    res.json(response);
  }
});

app.post("/api/tip", async (req: Request, res: Response) => {
  const { amount } = req.query;

  const transaction = await prepareSTRKTransaction(amount as string);

  res.json({ transaction });
});

export async function prepareSTRKTransaction(amount: string): Promise<string> {
  const formattedAmount = uint256.bnToUint256(
    BigInt(parseFloat(amount) * 10 ** 18)
  );

  const transferCall: Call = strkContract.populate("transfer", {
    recipient: DONATION_DESTINATION_WALLET,
    amount: formattedAmount,
  });

  return JSON.stringify(transferCall);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
