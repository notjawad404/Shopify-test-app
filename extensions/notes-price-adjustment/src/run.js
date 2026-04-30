// @ts-nocheck

/**
 * Notes Price Adjustment — Cart Transform Function
 *
 * This function runs on every cart request. For each line item that has
 * the "_notes_added" property set to "true", it reads the product's
 * "notes_price" metafield and adds that amount to the unit price.
 *
 * @param {Object} input - The cart input from the GraphQL query
 * @returns {Object} - Cart transform operations
 */
export function cartTransformRun(input) {
  const operations = [];

  // Protect against empty input structures
  if (!input || !input.cart || !input.cart.lines) {
    return { operations };
  }

  for (const line of input.cart.lines) {
    // Check if a note was added to this line item
    const notesAdded = line.notesAdded?.value;
    if (notesAdded !== "true") continue;

    // Get the configured note price from the product metafield
    const notesPriceValue = line.merchandise?.product?.notesPrice?.value;
    if (!notesPriceValue) continue;

    const notesPrice = parseFloat(notesPriceValue);
    if (isNaN(notesPrice) || notesPrice <= 0) continue;

    // Calculate new price = original price + note surcharge
    const originalPrice = parseFloat(line.cost.amountPerQuantity.amount);
    const currencyCode = line.cost.amountPerQuantity.currencyCode;
    const newPrice = originalPrice + notesPrice;

    operations.push({
      update: {
        cartLineId: line.id,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: newPrice.toFixed(2),
              currencyCode: currencyCode,
            },
          },
        },
      },
    });
  }

  return { operations };
}
