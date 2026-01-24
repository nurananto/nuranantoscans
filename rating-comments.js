/**
 * RATING & COMMENTS HANDLER - READER PAGE
 * Handles chapter rating and comments functionality
 */

const WORKER_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';

class RatingCommentsHandler {
  constructor() {
    this.mangaId = null;
    this.chapterId = null;
    this.currentUserId = null;
    this.currentUsername = null;
    this.isLoggedIn = false;
    this.userRating = null;
    this.hasRated = false;
    this.selectedRating = 0;
    this.commentsOffset = 0;
    this.commentsLimit = 20;
    this.hasMoreComments = true;
  }

  /**
   * Initialize handler
   */
  async init(mangaId, chapterId) {
    this.mangaId = mangaId;
    this.chapterId = chapterId;
    
    // Check login status
    await this.checkLoginStatus();
    
    // Show/hide global login button
    const globalLoginRequired = document.getElementById('globalLoginRequired');
    if (globalLoginRequired) {
      globalLoginRequired.style.display = this.isLoggedIn ? 'none' : 'block';
    }
    
    // Initialize UI
    this.initRatingUI();
    this.initCommentsUI();
    
    // Load data
    await this.loadRating();
    await this.loadComments();
  }

  /**
   * Check if user is logged in
   */
  async checkLoginStatus() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      this.isLoggedIn = false;
      return;
    }

    try {
      // Verify token with backend
      const response = await fetch(`${WORKER_URL}/donatur/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.isLoggedIn = true;
        
        // Decode JWT to get user info (simple base64 decode)
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUserId = payload.userId;
        this.currentUsername = payload.email?.split('@')[0] || 'User';
      } else {
        this.isLoggedIn = false;
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('[RATING] Error checking login:', error);
      this.isLoggedIn = false;
    }
  }

  /**
   * Initialize Rating UI
   */
  initRatingUI() {
    const ratingStarsInput = document.getElementById('ratingStarsInput');
    const btnSubmitRating = document.getElementById('btnSubmitRating');
    const btnCancelRating = document.getElementById('btnCancelRating');

    if (ratingStarsInput) {
      const stars = ratingStarsInput.querySelectorAll('.star');
      
      stars.forEach((star, index) => {
        // Click to select rating
        star.addEventListener('click', () => {
          this.selectedRating = index + 1;
          this.updateStarsDisplay(this.selectedRating);
          this.updateRatingValueText(this.selectedRating);
          
          if (btnSubmitRating) {
            btnSubmitRating.disabled = false;
          }
        });

        // Hover effect
        star.addEventListener('mouseenter', () => {
          this.highlightStars(index + 1);
        });
      });

      ratingStarsInput.addEventListener('mouseleave', () => {
        this.updateStarsDisplay(this.selectedRating);
      });
    }

    if (btnSubmitRating) {
      btnSubmitRating.addEventListener('click', () => this.submitRating());
    }

  }

  /**
   * Initialize Comments UI
   */
  initCommentsUI() {
    const commentTextarea = document.getElementById('commentTextarea');
    const btnSubmitComment = document.getElementById('btnSubmitComment');
    const btnLoadMore = document.getElementById('btnLoadMoreComments');

    if (commentTextarea) {
      commentTextarea.addEventListener('input', (e) => {
        const charCount = e.target.value.length;
        document.getElementById('commentCharCount').textContent = charCount;
        
        if (btnSubmitComment) {
          btnSubmitComment.disabled = charCount === 0 || charCount > 500;
        }
      });
    }

    if (btnSubmitComment) {
      btnSubmitComment.addEventListener('click', () => this.submitComment());
    }

    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', () => this.loadComments(true));
    }
  }

  /**
   * Load chapter rating from API
   */
  async loadRating() {
    const ratingLoading = document.getElementById('ratingLoading');
    const ratingDisplay = document.getElementById('ratingDisplay');
    const ratingInput = document.getElementById('ratingInput');

    // Show loading
    if (ratingLoading) ratingLoading.style.display = 'flex';
    if (ratingDisplay) ratingDisplay.style.display = 'none';
    if (ratingInput) ratingInput.style.display = 'none';

    try {
      const token = localStorage.getItem('authToken');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch(
        `${WORKER_URL}/ratings/chapter/${this.mangaId}/${this.chapterId}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Update display (ALWAYS show rating score for everyone)
        document.getElementById('ratingScore').textContent = data.bayesianAverage.toFixed(1);
        document.getElementById('ratingCount').textContent = data.totalRatings;
        document.getElementById('ratingStarsDisplay').textContent = this.generateStarsDisplay(data.bayesianAverage);

        this.userRating = data.userRating;
        this.hasRated = data.userRating !== null;

        // Hide loading, show rating display
        if (ratingLoading) ratingLoading.style.display = 'none';
        if (ratingDisplay) ratingDisplay.style.display = 'block';

        if (this.isLoggedIn) {
          // User logged in
          if (this.hasRated) {
            // User already rated - just show display (no edit option)
            if (ratingInput) ratingInput.style.display = 'none';
          } else {
            // User hasn't rated yet - show input form below display
            if (ratingInput) ratingInput.style.display = 'block';
          }
        } else {
          // User not logged in - just show rating display (no input)
          if (ratingInput) ratingInput.style.display = 'none';
        }
      } else {
        throw new Error('Failed to load rating');
      }
    } catch (error) {
      console.error('[RATING] Error loading rating:', error);
      
      // Show default 8.0 rating (Bayesian prior) when no data available
      if (ratingLoading) ratingLoading.style.display = 'none';
      if (ratingDisplay) {
        ratingDisplay.style.display = 'block';
        document.getElementById('ratingScore').textContent = '8.0';
        document.getElementById('ratingCount').textContent = '0';
        document.getElementById('ratingStarsDisplay').textContent = this.generateStarsDisplay(8.0);
      }
      
      // Show input only for logged in users
      if (this.isLoggedIn) {
        if (ratingInput) ratingInput.style.display = 'block';
      } else {
        if (ratingInput) ratingInput.style.display = 'none';
      }
    }
  }

  /**
   * Submit rating
   */
  async submitRating() {
    if (this.selectedRating === 0) {
      alert('Pilih rating terlebih dahulu (1-10)');
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Login terlebih dahulu untuk memberikan rating');
      return;
    }

    const btnSubmitRating = document.getElementById('btnSubmitRating');
    if (btnSubmitRating) {
      btnSubmitRating.disabled = true;
      btnSubmitRating.textContent = 'Submitting...';
    }

    try {
      const response = await fetch(`${WORKER_URL}/ratings/chapter`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mangaId: this.mangaId,
          chapterId: this.chapterId,
          rating: this.selectedRating
        })
      });

      if (response.ok) {
        // Success - show success state
        if (btnSubmitRating) {
          btnSubmitRating.classList.add('success');
          btnSubmitRating.textContent = '✅ Rating Berhasil Disimpan!';
          btnSubmitRating.disabled = true;
        }
        
        this.hasRated = true;
        
        // Wait 2 seconds to show success state, then reload and hide
        setTimeout(async () => {
          await this.loadRating();
          const ratingInput = document.getElementById('ratingInput');
          if (ratingInput) {
            ratingInput.style.display = 'none';
          }
        }, 2000);
      } else {
        const error = await response.json();
        alert('❌ ' + (error.error || 'Gagal menyimpan rating'));
        
        if (btnSubmitRating) {
          btnSubmitRating.disabled = false;
          btnSubmitRating.textContent = 'Submit Rating';
        }
      }
    } catch (error) {
      console.error('[RATING] Error submitting rating:', error);
      alert('❌ Terjadi kesalahan saat menyimpan rating');
      
      if (btnSubmitRating) {
        btnSubmitRating.disabled = false;
        btnSubmitRating.textContent = 'Submit Rating';
      }
    }
  }

  /**
   * Update stars visual display
   */
  updateStarsDisplay(rating) {
    const stars = document.querySelectorAll('#ratingStarsInput .star');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('filled');
        star.textContent = '★';
      } else {
        star.classList.remove('filled');
        star.textContent = '☆';
      }
      star.classList.remove('hover');
    });
  }

  /**
   * Highlight stars on hover
   */
  highlightStars(rating) {
    const stars = document.querySelectorAll('#ratingStarsInput .star');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('hover');
      } else {
        star.classList.remove('hover');
      }
    });
  }

  /**
   * Update rating value text
   */
  updateRatingValueText(rating) {
    const ratingValueText = document.getElementById('ratingValueText');
    if (ratingValueText) {
      ratingValueText.textContent = `Rating: ${rating} / 10`;
    }
  }

  /**
   * Generate stars display string
   */
  generateStarsDisplay(rating) {
    const fullStars = Math.floor(rating);
    const emptyStars = 10 - fullStars;
    return '⭐'.repeat(fullStars) + '☆'.repeat(emptyStars);
  }

  /**
   * Load comments from API
   */
  async loadComments(loadMore = false) {
    const commentsLoading = document.getElementById('commentsLoading');
    const commentsList = document.getElementById('commentsList');
    const commentsEmpty = document.getElementById('commentsEmpty');
    const commentsLoadMore = document.getElementById('commentsLoadMore');
    const commentInputContainer = document.getElementById('commentInputContainer');

    if (!loadMore) {
      // Initial load
      this.commentsOffset = 0;
      if (commentsList) commentsList.innerHTML = '';
      if (commentsLoading) commentsLoading.style.display = 'flex';
      if (commentsEmpty) commentsEmpty.style.display = 'none';
      if (commentsLoadMore) commentsLoadMore.style.display = 'none';

      // Show input only for logged in users
      if (commentInputContainer) {
        commentInputContainer.style.display = this.isLoggedIn ? 'block' : 'none';
      }
    }

    try {
      // Add cache-busting parameter to force fresh data
      const cacheBuster = `&_t=${Date.now()}`;
      const url = `${WORKER_URL}/comments?mangaId=${this.mangaId}&chapterId=${this.chapterId}&limit=${this.commentsLimit}&offset=${this.commentsOffset}${cacheBuster}`;
      
      dLog('[COMMENTS] Fetching from:', url);
      
      const response = await fetch(url);

      dLog('[COMMENTS] Response status:', response.status, response.statusText);
      dLog('[COMMENTS] Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        dLog('[COMMENTS] Data received:', data);
        
        if (commentsLoading) commentsLoading.style.display = 'none';

        if (data.comments.length === 0 && this.commentsOffset === 0) {
          // No comments at all
          dLog('[COMMENTS] No comments found');
          if (commentsEmpty) commentsEmpty.style.display = 'block';
        } else {
          // Render comments
          dLog('[COMMENTS] Rendering', data.comments.length, 'comments');
          data.comments.forEach(comment => {
            this.renderComment(comment);
          });

          // Update offset and check if more comments available
          this.commentsOffset += data.comments.length;
          this.hasMoreComments = this.commentsOffset < data.total;

          if (this.hasMoreComments) {
            if (commentsLoadMore) commentsLoadMore.style.display = 'block';
          } else {
            if (commentsLoadMore) commentsLoadMore.style.display = 'none';
          }
        }

        // Handle deep linking to comment (from notification)
        this.handleCommentDeepLink();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[COMMENTS] API error response:', errorData);
        throw new Error(`API returned ${response.status}: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[COMMENTS] Error loading comments:', error);
      console.error('[COMMENTS] Error stack:', error.stack);
      if (commentsLoading) commentsLoading.style.display = 'none';
      if (commentsEmpty) {
        let errorMsg = '❌ Gagal memuat komentar';
        
        // Check if it's a database error (table not found)
        if (error.message.includes('500') || error.message.includes('no such table')) {
          errorMsg = '❌ Database belum dikonfigurasi. Silakan jalankan d1-update-missing-tables.sql di D1 Console';
        } else if (error.message.includes('404')) {
          errorMsg = '❌ API endpoint tidak ditemukan. Cek WORKER_URL di rating-comments.js';
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          errorMsg = '❌ Koneksi ke server gagal. Cek CORS atau worker URL';
        } else {
          errorMsg = `❌ ${error.message}`;
        }
        
        commentsEmpty.innerHTML = `<p>${errorMsg}</p>`;
        commentsEmpty.style.display = 'block';
      }
    }
  }

  /**
   * Render single comment
   */
  renderComment(comment) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;

    dLog('[COMMENTS] Rendering comment:', comment);

    const commentItem = document.createElement('div');
    commentItem.className = 'comment-item';
    commentItem.id = `comment-${comment.id}`;

    // Format date
    const date = new Date(comment.created_at);
    const timeAgo = this.getTimeAgo(date);

    // Process content for @mentions
    const processedContent = this.processMentions(comment.content);

    // Ensure username is displayed
    const displayUsername = comment.username || 'Unknown User';

    commentItem.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">👤 ${displayUsername}</span>
        <span class="comment-date">${timeAgo}</span>
      </div>
      <div class="comment-content">${processedContent}</div>
      <div class="comment-actions">
        ${this.isLoggedIn ? `
          <button class="btn-reply-comment" data-username="${comment.username}">
            💬 Reply
          </button>
        ` : ''}
        ${this.isLoggedIn && comment.user_id === this.currentUserId ? `
          <button class="btn-delete-comment" data-comment-id="${comment.id}">
            🗑️ Delete
          </button>
        ` : ''}
      </div>
    `;

    commentsList.appendChild(commentItem);

    // Attach reply handler
    const btnReply = commentItem.querySelector('.btn-reply-comment');
    if (btnReply) {
      btnReply.addEventListener('click', () => this.replyToComment(comment.username));
    }

    // Attach delete handler
    const btnDelete = commentItem.querySelector('.btn-delete-comment');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => this.deleteComment(comment.id));
    }
  }

  /**
   * Process @mentions in content
   */
  processMentions(content) {
    return content.replace(/@([a-zA-Z0-9._-]+)/g, '<span class="mention">@$1</span>');
  }

  /**
   * Reply to comment - auto-fill textarea with @username
   */
  replyToComment(username) {
    const commentTextarea = document.getElementById('commentTextarea');
    const commentInputContainer = document.getElementById('commentInputContainer');
    
    if (!commentTextarea) return;
    
    // Set textarea value with @mention
    commentTextarea.value = `@${username} `;
    commentTextarea.focus();
    
    // Update character count
    const charCount = document.getElementById('commentCharCount');
    if (charCount) {
      charCount.textContent = commentTextarea.value.length;
    }
    
    // Scroll to comment input smoothly
    if (commentInputContainer) {
      commentInputContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Submit comment
   */
  async submitComment() {
    const commentTextarea = document.getElementById('commentTextarea');
    const btnSubmitComment = document.getElementById('btnSubmitComment');

    if (!commentTextarea) return;

    const content = commentTextarea.value.trim();
    if (!content) {
      alert('Komentar tidak boleh kosong');
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Login terlebih dahulu untuk berkomentar');
      return;
    }

    if (btnSubmitComment) {
      btnSubmitComment.disabled = true;
      btnSubmitComment.textContent = 'Posting...';
    }

    try {
      const response = await fetch(`${WORKER_URL}/comments/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mangaId: this.mangaId,
          chapterId: this.chapterId,
          content: content
        })
      });

      if (response.ok) {
        // Success - clear textarea
        commentTextarea.value = '';
        document.getElementById('commentCharCount').textContent = '0';
        
        // Reload comments from start
        await this.loadComments();
        
        alert('✅ Komentar berhasil diposting!');
      } else {
        const error = await response.json();
        alert('❌ ' + (error.error || 'Gagal memposting komentar'));
      }
    } catch (error) {
      console.error('[COMMENTS] Error submitting comment:', error);
      alert('❌ Terjadi kesalahan saat memposting komentar');
    } finally {
      if (btnSubmitComment) {
        btnSubmitComment.disabled = false;
        btnSubmitComment.textContent = 'Post Comment';
      }
    }
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId) {
    if (!confirm('Hapus komentar ini?')) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Login terlebih dahulu');
      return;
    }

    try {
      const response = await fetch(`${WORKER_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Success - remove from DOM
        const commentItem = document.getElementById(`comment-${commentId}`);
        if (commentItem) {
          commentItem.remove();
        }
        alert('✅ Komentar berhasil dihapus');
        
        // Reload if no more comments visible
        const commentsList = document.getElementById('commentsList');
        if (commentsList && commentsList.children.length === 0) {
          await this.loadComments();
        }
      } else {
        const error = await response.json();
        alert('❌ ' + (error.error || 'Gagal menghapus komentar'));
      }
    } catch (error) {
      console.error('[COMMENTS] Error deleting comment:', error);
      alert('❌ Terjadi kesalahan saat menghapus komentar');
    }
  }

  /**
   * Handle deep link to specific comment (from notification)
   */
  handleCommentDeepLink() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#comment-')) {
      const commentId = hash.replace('#comment-', '');
      const commentElement = document.getElementById(`comment-${commentId}`);
      
      if (commentElement) {
        // Scroll to comment
        setTimeout(() => {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          commentElement.classList.add('highlight');
          
          // Remove highlight after animation
          setTimeout(() => {
            commentElement.classList.remove('highlight');
          }, 2000);
        }, 500);
      }
    }
  }

  /**
   * Get time ago string
   */
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 7) {
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } else if (diffDay > 0) {
      return `${diffDay} hari lalu`;
    } else if (diffHour > 0) {
      return `${diffHour} jam lalu`;
    } else if (diffMin > 0) {
      return `${diffMin} menit lalu`;
    } else {
      return 'Baru saja';
    }
  }
}

// Export for use in reader.js
window.RatingCommentsHandler = RatingCommentsHandler;
