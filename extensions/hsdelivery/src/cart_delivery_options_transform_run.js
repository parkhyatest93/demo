/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {
  const message = "May be delayed due to weather conditions";
  let toRename = input.cart.deliveryGroups
    .filter(group => group.deliveryAddress?.countryCode && group.deliveryAddress.countryCode === "IN")
    .flatMap(group => group.deliveryOptions)
    .map(option => ({
      deliveryOptionRename: {
        deliveryOptionHandle: option.handle,
        title: option.title ? `${option.title} - ${message}` : message
      }
    }));

  return { operations: toRename };
}







// delivery optional 


// /**
//  * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
//  */

// /**
//  * @param {RunInput} input
//  * @returns {CartDeliveryOptionsTransformRunResult}
//  */

// const NO_CHANGES = {
//   operations: [],
// };


// export function cartDeliveryOptionsTransformRun(input) {
 
//   const configuration = JSON.parse(
//     input?.deliveryCustomization?.metafield?.value ?? "{}"
//   );

//   // Extract configured countries from configuration
//   // const configuredCountries = configuration.countryCode || [];
//   // if (!configuredCountries.length) return NO_CHANGES;

//   // Check delivery address country code
//   const deliveryGroups = input.cart?.deliveryGroups || [];
//   if (!deliveryGroups.length) return NO_CHANGES;

//   // const countryCode = deliveryGroups[0]?.deliveryAddress?.countryCode;
//   // if (!configuredCountries.includes(countryCode)) return NO_CHANGES;

//   // Check if any product has the perishable tag
//   const cartLines = input.cart?.lines || [];
//   const hasPerishableItem = cartLines.some(line => {
//     // More flexible check that doesn't require __typename
//     return (line.merchandise?.product  &&
//       line.merchandise?.product)?.hasTags?.some(tagResponse =>
//         tagResponse.hasTag && tagResponse.tag == "perishable"
//       );
//   });

//   if (!hasPerishableItem) return NO_CHANGES;

//   // Find the free delivery option, comparing the cost to 0.0
//   const deliveryOptions = deliveryGroups[0]?.deliveryOptions || [];
//   const freeDeliveryOption = deliveryOptions.find(option =>
//     option.cost?.amount == 0
//   );

//   if (!freeDeliveryOption) return NO_CHANGES;


//   // Hide the free delivery option
//   return {
//     operations: [
//       {
//         deliveryOptionHide: {
//           deliveryOptionHandle: freeDeliveryOption.handle
//         }
//       }
//     ]
//   };
// }




