/**
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {
  const message = "May be delayed due to weather conditions";
  let toRename = input.cart.deliveryGroups
    .filter(group => group.deliveryAddress?.provinceCode && group.deliveryAddress.provinceCode === "MP")
    .flatMap(group => group.deliveryOptions)
    .map(option => ({
      deliveryOptionRename: {
        deliveryOptionHandle: option.handle,
        title: option.title ? `${option.title} - ${message}` : message
      }
    }));

  return { operations: toRename };
}