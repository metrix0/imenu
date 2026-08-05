export const CONSUMER_EVENTS = {
    menuViewed: "consumer_menu_viewed",
    itemViewed: "consumer_item_viewed",
    itemAddedToCart: "consumer_item_added_to_cart",
    informationStarted: "consumer_information_started",
    addressStarted: "consumer_address_started",
    paymentStarted: "consumer_payment_started",
} as const;

export type ConsumerEventName =
    (typeof CONSUMER_EVENTS)[keyof typeof CONSUMER_EVENTS];
