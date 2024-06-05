import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const postsContract = c.router({
  updatePostThumbnail: {
    body: c.type<{ thumbnail: File }>(), // <- Use File type in here
    contentType: "dsadsa", // <- Only difference
    method: "POST",
    path: "/posts/:id/thumbnail",
    responses: {
      200: z.object({
        uploadedFile: z.object({
          name: z.string(),
          size: z.number(),
          type: z.string(),
        }),
      }),
      400: z.object({
        message: z.string(),
      }),
    },
  },
});
