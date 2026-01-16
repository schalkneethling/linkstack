import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookmarksService } from "../../src/services/bookmarks.service.js";

describe("BookmarksService", () => {
  let bookmarksService;
  let mockSupabase;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      delete: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
    };

    bookmarksService = new BookmarksService(mockSupabase);
  });

  describe("getAll", () => {
    it("should fetch all bookmarks ordered by created_at desc", async () => {
      const mockBookmarks = [
        { id: "1", page_title: "Test 1", created_at: "2024-01-02" },
        { id: "2", page_title: "Test 2", created_at: "2024-01-01" },
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockBookmarks,
        error: null,
      });

      const result = await bookmarksService.getAll();

      expect(mockSupabase.from).toHaveBeenCalledWith("bookmarks");
      expect(mockSupabase.select).toHaveBeenCalledWith("*");
      expect(mockSupabase.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(result).toEqual(mockBookmarks);
    });

    it("should throw error if fetch fails", async () => {
      const error = new Error("Database error");
      mockSupabase.order.mockResolvedValue({
        data: null,
        error,
      });

      await expect(bookmarksService.getAll()).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getById", () => {
    it("should fetch a single bookmark by id", async () => {
      const mockBookmark = { id: "1", page_title: "Test" };

      mockSupabase.single.mockResolvedValue({
        data: mockBookmark,
        error: null,
      });

      const result = await bookmarksService.getById("1");

      expect(mockSupabase.from).toHaveBeenCalledWith("bookmarks");
      expect(mockSupabase.select).toHaveBeenCalledWith("*");
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "1");
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(result).toEqual(mockBookmark);
    });

    it("should throw error if bookmark not found", async () => {
      const error = new Error("Not found");
      mockSupabase.single.mockResolvedValue({
        data: null,
        error,
      });

      await expect(bookmarksService.getById("999")).rejects.toThrow(
        "Not found",
      );
    });
  });

  describe("create", () => {
    it("should create a new bookmark", async () => {
      const newBookmark = {
        url: "https://example.com",
        page_title: "Example",
        meta_description: "Test description",
        preview_img: "https://example.com/image.jpg",
      };

      const createdBookmark = {
        id: "123",
        ...newBookmark,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSupabase.select.mockResolvedValue({
        data: [createdBookmark],
        error: null,
      });

      const result = await bookmarksService.create(newBookmark);

      expect(mockSupabase.from).toHaveBeenCalledWith("bookmarks");
      expect(mockSupabase.insert).toHaveBeenCalledWith(newBookmark);
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(result).toEqual(createdBookmark);
    });

    it("should throw error if create fails", async () => {
      const error = new Error("Insert failed");
      mockSupabase.select.mockResolvedValue({
        data: null,
        error,
      });

      await expect(
        bookmarksService.create({ url: "test" }),
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("update", () => {
    it("should update an existing bookmark", async () => {
      const updates = {
        page_title: "Updated Title",
        meta_description: "Updated Description",
      };

      const updatedBookmark = {
        id: "1",
        ...updates,
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockSupabase.select.mockResolvedValue({
        data: [updatedBookmark],
        error: null,
      });

      const result = await bookmarksService.update("1", updates);

      expect(mockSupabase.from).toHaveBeenCalledWith("bookmarks");
      expect(mockSupabase.update).toHaveBeenCalledWith(updates);
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "1");
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(result).toEqual(updatedBookmark);
    });

    it("should throw error if update fails", async () => {
      const error = new Error("Update failed");
      mockSupabase.select.mockResolvedValue({
        data: null,
        error,
      });

      await expect(bookmarksService.update("1", {})).rejects.toThrow(
        "Update failed",
      );
    });

    it("should throw error if bookmark not found", async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(bookmarksService.update("999", {})).rejects.toThrow(
        "Bookmark with id 999 not found",
      );
    });
  });

  describe("delete", () => {
    it("should delete a bookmark", async () => {
      mockSupabase.eq.mockResolvedValue({
        error: null,
      });

      await bookmarksService.delete("1");

      expect(mockSupabase.from).toHaveBeenCalledWith("bookmarks");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "1");
    });

    it("should throw error if delete fails", async () => {
      const error = new Error("Delete failed");
      mockSupabase.eq.mockResolvedValue({
        error,
      });

      await expect(bookmarksService.delete("1")).rejects.toThrow(
        "Delete failed",
      );
    });
  });
});
