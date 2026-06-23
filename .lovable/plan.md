# Create the `quottr_monthly` price in Stripe

Your `STRIPE_BYOK_SECRET_KEY` is a **test** key (it starts with `sk_test_`, which is why `getStripeEnv()` is resolving to sandbox mode). So you need to create the product/price in **Stripe's test mode**.

## Direct URLs (test mode)

1. Create the product + price:
  [https://dashboard.stripe.com/test/products/create](https://dashboard.stripe.com/test/products/create)
  - Name: `Quottr subscription`
  - Pricing model: **Recurring**
  - Price: `29.00` GBP
  - Billing period: **Monthly**
  - Click **Add product**
2. After saving, you'll land on the product page. Click the price row, then **... → Edit price**, and set:
  - **Lookup key**: `quottr_monthly`
  - Save
   (If "Lookup key" isn't visible on the edit modal, open the price directly from the product page URL — it's a field under "Advanced".)

## When you eventually go live

Repeat the same steps at [https://dashboard.stripe.com/products/create](https://dashboard.stripe.com/products/create) (no `/test/`) using the same lookup key `quottr_monthly`, so the code keeps working when you swap in a live `sk_live_...` key.

## Verifying

Once saved, click **Add payment method** in Settings again — the checkout should open instead of erroring.

ok done also can update the monthly pricing to £34.99 on the website and any other places that show our pricing