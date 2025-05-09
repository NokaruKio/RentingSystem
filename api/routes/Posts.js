const express = require("express");
const router = express.Router();

// db, dùng trong mọi trang
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

const imageDownloader = require('image-downloader')
const multer = require('multer')
const fs = require('fs')

// lưu ý đoạn path này nha
const path = require('path')
const parPath = path.join(__dirname, '..')
router.use('/uploads', express.static(path.join(parPath, 'uploads')))

const bcrypt = require('bcryptjs')
const bcryptSalt = bcrypt.genSaltSync(10)
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
router.use(cookieParser())
const jwtSecret = 'fhdjskahdfjkdsafhjdshakjhf'

const createNotification = async (userId, type, message, placeId = null) => {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type,
          message,
          placeId: parseInt(placeId),  // Lưu placeId nếu có
        },
      });
    } catch (error) {
      console.error("Error creating notification", error);
    }
};

router.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;

    try {
        // Tạo tên file mới
        const newName = 'photo' + Date.now() + '.jpg';

        // Tạo đường dẫn file một cách an toàn
        const destination = path.join(parPath, 'uploads', newName);

        // Tải hình ảnh từ link
        await imageDownloader.image({
            url: link,
            dest: destination
        });

        // Phản hồi thành công với tên file
        res.json(newName);
    } catch (error) {
        console.error('Error downloading image:', error.message);

        // Trả về lỗi với thông báo cụ thể
        res.status(500).json({
            success: false,
            message: 'Failed to download the image. Please check the link and try again.',
            error: error.message
        });
    }
});

// const photosMiddleware = multer({dest: path.join(parPath, 'uploads/')})
const photosMiddleware = multer({dest: 'uploads/'}) // đoạn này chỉ như này thôi
router.post('/upload', photosMiddleware.array('photos', 100), (req, res) => {
    const uploadedFiles = [];

    try {
        // Lặp qua tất cả các file đã upload
        for (let i = 0; i < req.files.length; i++) {
            const { path: tempPath, originalname } = req.files[i]; // Lấy đường dẫn tạm và tên gốc
            const fileExt = path.extname(originalname); // Lấy đuôi file (vd: .jpg, .png)
            const newPath = tempPath + fileExt; // Thêm đuôi file vào đường dẫn mới

            // Đổi tên file (chuyển từ đường dẫn tạm sang đường dẫn mới)
            fs.renameSync(tempPath, newPath);

            // Lưu đường dẫn file (bỏ tiền tố 'uploads\\' để trả về đường dẫn đơn giản hơn)
            uploadedFiles.push(newPath.replace(path.join('uploads', ''), '').replace(/\\/g, '/'));
        }

        // Trả về danh sách file đã upload
        res.json(uploadedFiles);
    } catch (error) {
        console.error('Error during file upload:', error.message);

        // Trả về lỗi nếu quá trình xử lý xảy ra vấn đề
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the uploaded files.',
            error: error.message,
        });
    }
});

async function cleanUnusedPhotos() {
    try {
        const photosPost = await prisma.placePhoto.findMany({
            select: { url: true }
        });

        const photosInvoice = await prisma.invoicePhoto.findMany({
            select: { url: true }
        });

        const photosAvatar = await prisma.user.findMany({
            select: { avatar: true }
        });

        // Hợp nhất các danh sách ảnh từ các bảng khác nhau
        const photoUrlsInDatabase = [
            ...photosPost.map(photo => path.basename(photo.url)), // Tên file từ placePhoto
            ...photosInvoice.map(photo => path.basename(photo.url)), // Tên file từ invoicePhoto
            ...photosAvatar
                .filter(photo => photo.avatar) // Loại bỏ null hoặc undefined
                .map(photo => path.basename(photo.avatar)) // Tên file từ user.avatar
        ];

        const uploadsFolder = path.join(parPath, 'uploads');
        // Tạo một danh sách các file ảnh hiện có trong thư mục uploads
        const filesInFolder = fs.readdirSync(uploadsFolder);

        // Lọc những file không có trong database
        const unusedFiles = filesInFolder.filter(file => !photoUrlsInDatabase.includes(file));

        // Xóa những file không còn được sử dụng
        unusedFiles.forEach(file => {
            const filePath = path.join(uploadsFolder, file);
            fs.unlinkSync(filePath);
            console.log(`Deleted unused photo: ${filePath}`);
        });

        console.log('Cleanup completed successfully!');
    } catch (error) {
        console.error('Error while cleaning up photos:', error);
    } finally {
        await prisma.$disconnect();
    }
}

router.post('/places', async (req, res) => {
    const { token } = req.cookies;
    const {
        title, address, latitude, longitude,
        addedPhotos,
        description, perks, extraInfo,
        area, duration, price
    } = req.body;

    try {
        // Kiểm tra token có tồn tại hay không
        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication token is missing.' });
        }

        // Xác thực token
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) {
                console.error('JWT Verification Error:', err.message);
                return res.status(403).json({ success: false, message: 'Invalid token.' });
            }

            // Kiểm tra dữ liệu cần thiết
            if (!title || !address || !addedPhotos || !area || !duration || !price) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Missing required fields. Please provide all necessary information.' 
                });
            }

            // Tạo dữ liệu place
            try {
                const placeData = await prisma.place.create({
                    data: {
                        owner: {
                            connect: { id: userData.id }, // Kết nối với User theo id
                        },
                        title,
                        address,
                        latitude,
                        longitude,
                        description,
                        extraInfo,
                        area: parseInt(area),
                        duration: parseInt(duration),
                        price: parseFloat(price),
                        photos: {
                            create: addedPhotos.map(photo => ({ url: photo })), // Tạo các bản ghi PlacePhoto
                        },
                        perks: {
                            create: perks.map(perk => ({ perk: perk })), // Tạo các bản ghi PlacePerk
                        },
                    },
                });

                // Phản hồi thành công
                res.json(placeData);

                // Xóa các ảnh không sử dụng
                cleanUnusedPhotos();
            } catch (dbError) {
                console.error('Database Error:', dbError.message);
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to create place. Please try again later.', 
                    error: dbError.message 
                });
            }
        });
    } catch (error) {
        console.error('Unexpected Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred. Please try again later.',
            error: error.message,
        });
    }
});

router.get('/user-places', async (req, res) => {
    const { token } = req.cookies;

    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }

    try {
        // Kiểm tra và giải mã token
        const userData = await new Promise((resolve, reject) => {
            jwt.verify(token, jwtSecret, (err, decoded) => {
                if (err) return reject(err);
                resolve(decoded);
            });
        });

        const { id } = userData;

        // Truy vấn danh sách địa điểm từ cơ sở dữ liệu
        const places = await prisma.place.findMany({
            where: {
                ownerId: id
            },
            include: {
                photos: true,
                bookings: true
            }
        });

        // Trả về kết quả
        res.json(places);
    } catch (error) {
        // Xử lý lỗi
        console.error('Error occurred:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired' });
        }
        res.status(500).json({ error: 'Something went wrong, please try again later' });
    }
});

router.get('/place/:id', async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;
    try {
        let userId = null;

        // Giải mã token để lấy userId
        if (token) {
            jwt.verify(token, jwtSecret, (err, userData) => {
                if (err) {
                    console.error('Invalid JWT:', err);
                } else {
                    userId = userData.id; // Lấy userId từ JWT
                }
            });
        }

        const place = await prisma.place.findUnique({
            where: { id: parseInt(id, 10) },
            include: {
                photos: true,
                perks: true,
                owner: { // Lấy thông tin chủ trọ
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        phone: true,
                        birthDate: true,
                        violationCount: true,
                        createAt: true,
                        status: true
                    },
                },
                bookings: { // Lấy các booking liên quan
                    include: {
                        invoices: { // Lấy invoices liên quan tới booking
                            include: {
                                photos: true, // Lấy ảnh của Invoice
                            },
                        },
                        comments: true
                    },
                },
                reports: { // Bao gồm thông tin đầy đủ của người báo cáo
                    include: {
                        reporter: { // Lấy thông tin người báo cáo
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                                phone: true,
                                birthDate: true,
                            },
                        },
                    },
                },
            },
        });

        if (!place) {
            return res.status(404).json({ message: 'Place không tồn tại' });
        }

        // Kiểm tra trạng thái của Place và Owner
        if (place.status !== 'SEE' || place.owner.status !== 'ACTIVE') {
            // Nếu userId (chủ nhà) trùng với ownerId của place, vẫn trả về Place
            if (userId !== place.ownerId) {
                return res.status(404).json({ message: 'Place không tồn tại' });
            }
        }

        res.json({ place });
    } catch (error) {
        console.error('Error fetching place:', error);
        res.status(500).json({ message: 'Lỗi khi lấy thông tin Place.' });
    }
});

// rout này kha khá giống route ở trên, nhưng cái này phục vụ chức năng cho người chủ nhà
// nó sẽ liệt kê ra các lượt book để chờ duyệt
router.get('/placedetail/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Kiểm tra id có hợp lệ không
        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid place ID. Please provide a valid numeric ID.' 
            });
        }

        // Truy vấn dữ liệu từ cơ sở dữ liệu
        const place = await prisma.place.findUnique({
            where: { id: parseInt(id, 10) },
            include: {
                photos: true,
                perks: true,
                bookings: {
                    include: {
                        comments: true,
                        invoices: {
                            include: {
                                photos: true
                            }
                        },
                        renter: {
                            select: {
                                id: true,
                                name: true,
                                avatar: true,
                                phone: true,
                                birthDate: true,
                            },
                        },
                    },
                },
                reports: {
                    include: {
                        reporter: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                                phone: true,
                                birthDate: true,
                            },
                        },
                    },
                },
            },
        });

        // Kiểm tra nếu không tìm thấy place
        if (!place) {
            return res.status(404).json({ 
                success: false, 
                message: 'Place not found. Please check the ID and try again.' 
            });
        }

        // Trả về dữ liệu nếu thành công
        res.json({ place });
    } catch (error) {
        console.error('Error fetching place details:', error.message);

        // Trả về lỗi nếu xảy ra vấn đề không mong đợi
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching place details. Please try again later.',
            error: error.message,
        });
    }
});

router.put('/places/:id', async (req, res) => {
    const { id } = req.params;
    const {
        title, address, latitude, longitude,
        addedPhotos,
        description, perks, extraInfo, price,
        area, duration
    } = req.body;

    try {
        // Xóa các ảnh và perks cũ trước khi thêm mới
        await prisma.placePhoto.deleteMany({
            where: { placeId: parseInt(id, 10) }
        });
        await prisma.placePerk.deleteMany({
            where: { placeId: parseInt(id, 10) }
        });

        // Cập nhật thông tin của Place và thêm các ảnh và perks mới
        const updatedPlace = await prisma.place.update({
            where: { id: parseInt(id, 10) },
            data: {
                title,
                address, latitude, longitude,
                description,
                extraInfo,
                area: parseInt(area), 
                price: parseFloat(price),
                duration: parseInt(duration),
                photos: {
                    create: addedPhotos.map(photo => ({ url: photo })), // Thêm các ảnh mới 
                },
                perks: {
                    create: perks.map(perk => ({ perk: perk })), // Thêm các perks mới
                },
            }
        });
        cleanUnusedPhotos()
        res.json(updatedPlace);
    } catch (error) {
        console.error("Error updating Place:", error);
        res.status(500).json({ error: "Something went wrong while updating the place." });
    }
});

router.get('/places', async (req, res) => {
    try {
        // Lấy danh sách các places có status là SEE và thuộc về người dùng có trạng thái ACTIVE
        const places = await prisma.place.findMany({
            where: {
                status: 'SEE', // Chỉ lấy places có status là SEE
                owner: {
                    status: 'ACTIVE', // Chỉ lấy places của chủ nhà có trạng thái ACTIVE
                },
            },
            include: {
                photos: true,
                perks: true,
            },
        });

        // Tính toán _min và _max cho price chỉ với places có status là SEE và thuộc về chủ nhà ACTIVE
        const priceStats = await prisma.place.aggregate({
            where: {
                status: 'SEE', // Chỉ tính toán trên các places có status là SEE
                owner: {
                    status: 'ACTIVE', // Chỉ tính toán trên places của chủ nhà ACTIVE
                },
            },
            _min: {
                price: true, // Trường 'price' là trường giá tiền
            },
            _max: {
                price: true,
            },
        });

        // Kết hợp dữ liệu và trả về JSON
        res.json({
            places,
            minPrice: priceStats._min.price || 0, // Giá trị nhỏ nhất (nếu không có, trả về 0)
            maxPrice: priceStats._max.price || 0, // Giá trị lớn nhất (nếu không có, trả về 0)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Đã xảy ra lỗi trong quá trình lấy dữ liệu' });
    }
});

router.post('/delete-home/:placeId', async (req, res) => {
    const { token } = req.cookies;
    const {placeId} = req.params
    const { password } = req.body;

    if (!token) {
        return res.status(401).json({ message: 'Token không tồn tại.' });
    }

    jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) {
            return res.status(401).json({ message: 'Token không hợp lệ.' });
        }

        const userId = userData.id;

        try {
            // Lấy thông tin người dùng
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return res.status(404).json({ message: 'Người dùng không tồn tại.' });
            }

            // Kiểm tra mật khẩu
            const isPasswordMatch = bcrypt.compareSync(password, user.password);
            if (!isPasswordMatch) {
                return res.status(400).json({ message: 'Mật khẩu không chính xác.' });
            }

            // Xóa nhà
            await prisma.place.delete({
                where: { id: parseInt(placeId, 10) },
            });

            return res.status(200).json({ message: 'Nhà này đã được xóa thành công.' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Có lỗi xảy ra khi xóa nhà này.' });
        }
    });
})

router.put('/hidden-home/:placeId', async (req, res) => {
    const { placeId } = req.params;

    try {
        // Lấy thông tin hiện tại của Place
        const place = await prisma.place.findUnique({
            where: { id: parseInt(placeId) },
        });

        if (!place) {
            return res.status(404).json({ message: 'Place không tồn tại' });
        }

        // Kiểm tra trạng thái hiện tại và chuyển đổi
        const newStatus = place.status === 'SEE' ? 'HIDDEN' : 'SEE';

        // Cập nhật trạng thái của Place
        const updatedPlace = await prisma.place.update({
            where: { id: parseInt(placeId) },
            data: { status: newStatus },
        });

        res.status(200).json({
            message: `Trạng thái của nhà này đã được đổi thành công.`,
            updatedPlace,
        });
    } catch (error) {
        console.error('Error updating place status:', error);
        res.status(500).json({ message: 'Lỗi khi xử lý yêu cầu.' });
    }
});

router.post('/add-report', async (req, res) => {
    const { token } = req.cookies;
    const { reason, placeId } = req.body;

    jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) {
            return res.status(401).json({ message: 'Token không hợp lệ.' });
        }

        const userId = userData.id;

        try {
            // Tạo report
            const report = await prisma.report.create({
                data: {
                    reporterId: userId,
                    reason: reason,
                    placeId: parseInt(placeId, 10)
                }
            });

            // phần tạo thông báo
            // Lấy thông tin chủ của place
            const place = await prisma.place.findUnique({
                where: {
                    id: parseInt(placeId),
                },
                select: {
                    ownerId: true, // Lấy ownerId của place
                },
            });

            if (!place) {
                return res.status(404).json({ message: 'Place không tồn tại.' });
            }

            const ownerId = place.ownerId;
            createNotification(ownerId, 'Report', `Có một báo cáo về nhà này.`, placeId)

            return res.status(200).json({ message: 'Report đã được gửi cho admin và chủ nhà.' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Có lỗi xảy ra khi tạo báo cáo.' });
        }
    });
});

router.get('/comments/:placeId', async (req, res) => {
    const { placeId } = req.params;
    try {
        const comments = await prisma.comment.findMany({
            where: { booking: { placeId: parseInt(placeId, 10) } },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Lỗi khi lấy bình luận.' });
    }
});

router.get('/comments/eligibility/:placeId/:userId', async (req, res) => {
    const { placeId, userId } = req.params;
    try {
        // Lấy tất cả các booking với trạng thái 'RENTED' của người dùng
        const bookings = await prisma.booking.findMany({
            where: {
                placeId: parseInt(placeId, 10),
                renterId: parseInt(userId, 10),
                status: 'RENTED',
            },
        });

        if (!bookings.length) {
            return res.json({ canComment: false }); // Không có booking nào hợp lệ
        }

        // Kiểm tra nếu mỗi booking đã có comment
        const bookingIds = bookings.map(booking => booking.id);
        const comments = await prisma.comment.findMany({
            where: {
                bookingId: { in: bookingIds }, // Tìm comment của các booking này
            },
        });

        // Lấy danh sách các booking đã được comment
        const commentedBookingIds = comments.map(comment => comment.bookingId);

        // Tìm booking chưa được comment
        const hasEligibleBooking = bookingIds.some(id => !commentedBookingIds.includes(id));

        return res.json({ canComment: hasEligibleBooking });
    } catch (error) {
        console.error('Error checking comment eligibility:', error);
        res.status(500).json({ message: 'Lỗi kiểm tra quyền bình luận.' });
    }
});

router.post('/comments', async (req, res) => {
    const { userId, placeId, content } = req.body;

    try {
        // Moderate the content
        const moderationResult = await moderateContent(content);
        if (moderationResult.flagged) {
            return res.status(400).json({
                message: 'Your comment contains inappropriate content.',
                categories: moderationResult.categories,
            });
        }

        // Lấy danh sách các booking hợp lệ
        const bookings = await prisma.booking.findMany({
            where: {
                placeId: parseInt(placeId, 10),
                renterId: parseInt(userId, 10),
                status: 'RENTED',
            },
        });

        if (!bookings.length) {
            return res.status(400).json({ message: 'Bạn không đủ điều kiện để bình luận.' });
        }

        // Lấy danh sách các comment đã có
        const bookingIds = bookings.map(booking => booking.id);
        const existingComments = await prisma.comment.findMany({
            where: {
                bookingId: { in: bookingIds },
            },
        });

        // Xác định booking chưa được comment
        const commentedBookingIds = existingComments.map(comment => comment.bookingId);
        const eligibleBooking = bookings.find(booking => !commentedBookingIds.includes(booking.id));

        if (!eligibleBooking) {
            return res.status(400).json({ message: 'Bạn đã bình luận cho tất cả các lượt thuê.' });
        }

        // Tạo bình luận mới cho booking đủ điều kiện
        const newComment = await prisma.comment.create({
            data: {
                content,
                userId: parseInt(userId, 10),
                bookingId: eligibleBooking.id,
            },
            include: { user: { select: { id: true, name: true } } },
        });

        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Lỗi khi thêm bình luận.' });
    }
});

// Check if the user has already favourited the place
router.get('/favourites/check', async (req, res) => {
    const { token } = req.cookies;
    if (token) {
      jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) throw err;
  
        // Kiểm tra nếu Place đã được yêu thích bởi người dùng
        const favourite = await prisma.favourite.findUnique({
          where: {
            userId_placeId: {
              userId: userData.id,
              placeId: parseInt(req.query.placeId), // ID của Place được yêu cầu
            },
          },
        });
  
        res.json({ isFavourite: favourite ? true : false });
      });
    } else {
      res.json({ isFavourite: false });
    }
});

// Add or remove favourite
// API để thêm yêu thích (POST)
router.post('/favourites', async (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, async (err, userData) => {
            if (err) throw err;
    
            const { placeId } = req.body;

            // Nếu chưa yêu thích, thêm yêu thích
            await prisma.favourite.create({
            data: {
                userId: userData.id,
                placeId,
                },
            });
            res.json({ isFavourite: true });
        });
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
});

// API để bỏ yêu thích (DELETE)
router.delete('/favourites', async (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) throw err;

        const { placeId } = req.body;

        // Xóa yêu thích nếu đã có
        await prisma.favourite.delete({
            where: {
                userId_placeId: {
                userId: userData.id,
                placeId,
                },
            },
        });
        res.json({ isFavourite: false });
        
        });
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

router.get('/favourites', async (req, res) => {
    const { token } = req.cookies;
    if (token) {
      jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) throw err;
  
        // Lấy danh sách các nhà yêu thích của người dùng
        const favouritePlaces = await prisma.favourite.findMany({
          where: { userId: userData.id },
          include: {
            place: {
                include: {
                    photos: true
                }
            }, // Lấy thông tin nhà (place) liên quan đến favourite
          },
        });
  
        // Trả về dữ liệu nhà yêu thích
        const places = favouritePlaces.map(fav => fav.place);
        res.json(places);
      });
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
});
  
// API: Lấy thông báo của người dùng
router.get('/notifications', async (req, res) => {
    const { token } = req.cookies;
  
    jwt.verify(token, jwtSecret, async (err, userData) => {
      if (err) {
        return res.status(401).json({ message: 'Token không hợp lệ.' });
      }
  
      const userId = userData.id;
  
      try {
        // Lấy thông báo của người dùng, giới hạn 5 thông báo mới nhất
        const notifications = await prisma.notification.findMany({
          where: { userId: userId },
          orderBy: { createdAt: 'desc' },
        //   take: 5,
          include: {
            place: {
              select: {
                id: true,
                photos: {
                  take: 1,
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        });
  
        const unreadCount = await prisma.notification.count({
          where: {
            userId: userId,
            read: false,
          },
        });
  
        return res.status(200).json({ notifications, unreadCount });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Có lỗi xảy ra khi lấy thông báo.' });
      }
    });
});

// API: Đánh dấu thông báo là đã đọc
router.post('/mark-as-read', async (req, res) => {
    const { token } = req.cookies;
    const { notificationId } = req.body;
  
    jwt.verify(token, jwtSecret, async (err, userData) => {
      if (err) {
        return res.status(401).json({ message: 'Token không hợp lệ.' });
      }
  
      try {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { read: true },
        });
  
        return res.status(200).json({ message: 'Đã đánh dấu thông báo là đã đọc.' });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Có lỗi xảy ra khi đánh dấu đã đọc.' });
      }
    });
});

const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Dynamically import and initialize Pinecone client
let index;
const initPineconePromise = (async () => {
  const pineconeMod = await import('@pinecone-database/pinecone');
  // Unwrap default export for CJS
  const pineconePkg = pineconeMod.default ?? pineconeMod;
  // Determine constructor: prefer PineconeClient, fallback to Pinecone
  const PineconeClient = pineconePkg.PineconeClient ?? pineconePkg.Pinecone ?? pineconePkg;
  if (typeof PineconeClient !== 'function') {
    console.error('Invalid PineconeClient constructor:', PineconeClient);
    return;
  }
  // Initialize Pinecone client directly with valid configuration
  const pineconeClient = new PineconeClient({
    apiKey: process.env.PINECONE_API_KEY,
  });
  // Assuming the client is ready to use after construction
  index = pineconeClient.Index('rentals');
  console.log('Pinecone initialized');
})();
initPineconePromise.catch(err => console.error('Error initializing Pinecone:', err));

router.get('/semantic-search', async (req, res) => {
  await initPineconePromise;
  const { q, topK = 10 } = req.query;
  try {
    const eRsp = await openai.embeddings.create({ model: 'text-embedding-ada-002', input: q });
    const queryVector = eRsp.data[0].embedding;
    const pineRsp = await index.query({ vector: queryVector, topK: parseInt(topK), includeMetadata: true });
    const ids = pineRsp.matches.map(m => Number(m.id));
    const posts = await prisma.post.findMany({ where: { id: { in: ids } } });
    return res.json(posts);
  } catch (err) {
    console.error('Semantic-search error:', err);
    // Quota/rate-limit
    if (err.status === 429) {
      return res.status(503).json({
        error: 'Semantic search temporarily unavailable. Please try again later.'
      });
    }
    // Other errors
    return res.status(500).json({ error: err.message });
  }
});

router.post('/chatbot', async (req, res) => {
  const { message } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    });

    const botReply = response.choices[0].message.content;
    res.json({ reply: botReply });
  } catch (error) {
    console.error('Chatbot error:', error.stack || error);
    // Return the real error message for debugging (remove in production)
    res.status(500).json({ error: error.message || error.toString() });
  }
});

// Function to moderate content using OpenAI's Moderation API
async function moderateContent(content) {
  try {
    const moderationResponse = await openai.moderations.create({
      input: content,
    });

    const results = moderationResponse.results[0];
    if (results.flagged) {
      return {
        flagged: true,
        categories: results.categories,
        categoryScores: results.category_scores,
      };
    }
    return { flagged: false };
  } catch (error) {
    console.error('Moderation error:', error);
    throw new Error('Failed to moderate content.');
  }
}

module.exports = router;