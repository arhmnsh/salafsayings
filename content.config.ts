import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    salafsayings: defineCollection({
      type: 'data',
      source: 'salafsayings.json',
      schema: z.object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        url: z.string(),
        quote: z.string(),
        intro: z.string().optional(),
        source: z.string().optional(),
        author: z.string().optional(),
        topics: z.array(z.string()),
        fetchedAt: z.string()
      })
    })
  }
})
