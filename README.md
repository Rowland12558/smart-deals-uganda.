# Smart Deals Uganda

A static, mobile friendly shopping discovery site for Uganda. Shoppers can browse a small hand maintained selection, search and filter products, save favourites in their own browser, open product pages on Jumia, and contact Smart Deals Uganda on WhatsApp.

## Run locally

Serve this folder over localhost, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Product links and referral disclosure

Product cards and category links go to Jumia pages directly. The separate JForce referral link in the footer is a general Jumia link and may earn a commission on qualifying purchases through that link. Product specific tracked JForce links are not configured.

## Add and manage listings

The catalogue is stored in `data/products.json` and is displayed to every visitor. The private editor is at `/admin/` and uses Decap CMS with Netlify Identity and Git Gateway. An invited editor signs in, edits the Listings collection (including product image and UGX price), and publishes; the CMS commits the catalogue to the connected Git repository and Netlify deploys it.

Before the editor can be used, enable Identity for the Netlify site, set registration to invite-only, enable Git Gateway, and invite only the owner's email address. Confirm the CMS branch in `admin/config.yml` matches the connected repository's production branch (`main` by default). The deployment must publish this project folder. Product images uploaded in the editor are stored under `assets/uploads` in Git.

Use accurate titles, descriptions, images, and destination links. Prices are not shown because the site has no live price or stock feed; visitors are directed to Jumia for current details. Review listings periodically and remove any that are no longer accurate. Do not claim a particular discount unless a verified promotion is available.

## Add and manage advertisements

Open `/admin/` directly to manage the catalogue and advertisements, sign in, and choose **Advertisements → Homepage ads**. Add an ad image, title, caption, destination link, and button text, then save and publish. Set **Show this ad** off to hide an ad without deleting it. The S-LINDA tablet artwork is the first example and its button opens WhatsApp at the number shown in the artwork. This editor uses the same Netlify Identity and Git Gateway setup described above for the catalogue.

## Private quotes and invoices

Open `/admin/quotes/` and sign in with the owner's Netlify Identity account. The quote manager allows the owner to prepare a UGX quotation, print it or choose **Save as PDF** in the browser's print dialog, and convert a customer-approved quote into an invoice. Customer records and prices are stored in the private `private-quotes` Netlify Blobs store and are not published in the product catalogue.

For access control, keep Netlify Identity registration invite-only and invite only the owner. Set the Netlify site environment variable `QUOTES_ADMIN_EMAIL` to the owner's exact Identity email, then redeploy. The serverless endpoint checks both the signed-in Identity user and this allowlisted email for every request; the email must not be added to public site code. Netlify Blobs must be available for the deployed site. A login or hidden page alone is not an access-control boundary; the private API enforces authorization.

## WhatsApp ordering, chat, and analytics

The floating chat widget lets visitors choose a product and send one of three questions to WhatsApp: whether it is available, how much it costs, or whether delivery is available. Visitors can also type a custom question. WhatsApp opens with their selected message prefilled; they tap Send in WhatsApp to deliver it.

Product cards can add items to a browser-saved cart. The cart is a quote request: the shopper sends it to the store on WhatsApp (no prices), the store confirms the total, and payment is requested only after the shopper approves it. The customer-facing Flutterwave form is hidden in the cart; send approved amounts as a Flutterwave Payment Link (created in the Flutterwave dashboard) or manual mobile money details.

The older description follows for reference. Product cards can add items to a browser-saved cart. The cart offers Flutterwave mobile money checkout for Uganda MTN and Airtel, plus a WhatsApp order option. Manual payment instructions show Airtel `0700321960` or MTN `0767776333`. Online payment requires real UGX prices on every cart item and a configured `FLW_SECRET_KEY` Netlify environment variable. The secret key must be entered in Netlify site environment variables and must never be placed in browser code or committed files. Customers enter their name, email, and Uganda mobile number; these details and the cart amount are sent to the Netlify function and Flutterwave to start a charge. After authorization, the site asks Flutterwave's server API to verify the transaction reference, amount and currency before displaying a payment verified message. The buyer still needs to send order details to the store on WhatsApp. Payment collection does not provide inventory, delivery, refund or order management.

To enable Flutterwave: activate a Flutterwave merchant account that supports Uganda UGX Mobile Money, add the secret key in Netlify under the site's environment variables as `FLW_SECRET_KEY`, then redeploy. Netlify Functions in `netlify/functions/` provide the payment initiation and verification endpoints. Use Flutterwave test credentials and test transactions first. The store must set real product prices in Decap CMS before customers can use automated payment; products with a missing/zero price are rejected by the function.

Optional integrations are configured in `data/integrations.json` or in Decap CMS under **Site settings → Chat and analytics**. Add your GA4 Measurement ID (`G-...`) to `googleAnalyticsId`. For Tawk.to, add the Property ID and Widget ID from Administration → Chat Widget. These IDs are not passwords, but they are public site identifiers. The integrations load only when valid IDs are supplied. Google Analytics also records WhatsApp order clicks and Jumia outbound clicks after it is configured.

Tawk.to widget setup: [Tawk.to installation guide](https://help.tawk.to/article/adding-the-tawkto-widget-to-your-website). Find your Google ID in Analytics under Admin → Data streams.

## Current scope and limitations

- Static front end hosted on Netlify; the editor publishes catalogue changes through Git Gateway.
- Favourites use local browser storage and are not synced between devices.
- No Jumia product feed, automatic price/stock updates, inventory, order database, refunds, or delivery management. Flutterwave payments will stay disabled until the merchant key is configured on Netlify.
- Product and category links are direct Jumia links. To track individual product referrals, create product specific JForce links in the approved JForce tools and add those links to the catalogue before switching the buttons.
- WhatsApp assistance uses the number configured as `WHATSAPP_NUMBER` in `app.js`.
