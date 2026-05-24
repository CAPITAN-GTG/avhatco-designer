import { adminFetch } from "@/app/lib/shopify";
import {
  parseJobStatus,
  SHOPIFY_JOB_STATUS_KEY,
  SHOPIFY_JOB_STATUS_NAMESPACE,
  type JobStatus,
} from "@/lib/adminJobStatus";

const ORDER_UPDATE_MUTATION = `
  mutation SetOrderJobStatus($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
        metafield(namespace: "${SHOPIFY_JOB_STATUS_NAMESPACE}", key: "${SHOPIFY_JOB_STATUS_KEY}") {
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type OrderUpdateResponse = {
  data?: {
    orderUpdate?: {
      order?: { id: string; metafield?: { value: string } | null } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
};

export async function setShopifyOrderJobStatus(
  orderId: string,
  status: JobStatus
): Promise<void> {
  const json = await adminFetch<OrderUpdateResponse>(ORDER_UPDATE_MUTATION, {
    input: {
      id: orderId,
      metafields: [
        {
          namespace: SHOPIFY_JOB_STATUS_NAMESPACE,
          key: SHOPIFY_JOB_STATUS_KEY,
          type: "single_line_text_field",
          value: status,
        },
      ],
    },
  });

  const errors = json.data?.orderUpdate?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  const saved = json.data?.orderUpdate?.order?.metafield?.value;
  if (saved) {
    parseJobStatus(saved);
  }
}
