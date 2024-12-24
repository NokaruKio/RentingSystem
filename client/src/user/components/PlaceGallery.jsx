import React, { useState } from 'react';
import { BASE_URL } from '../../config';

function PlaceGallery({ place }) {
    const [showAllPhotos, setShowAllPhotos] = useState(false);
    const [showImagePopup, setShowImagePopup] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    // Open Image Popup for a single photo
    const openImagePopup = (photoUrl) => {
        setSelectedImage(photoUrl);
        setShowImagePopup(true);
    };

    // Single image popup component
    let popup = null;
    if (showImagePopup) {
        popup = (
            <div
                className="fixed inset-0 bg-black bg-opacity-50 w-full h-full flex items-center justify-center z-50"
                onClick={() => setShowImagePopup(false)}
            >
                <div
                    className="relative p-8 rounded-lg bg-white w-full max-w-4xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowImagePopup(false)}
                            className="text-gray-500 hover:text-black text-lg"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                stroke="currentColor"
                                className="w-8 h-8"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="overflow-auto max-h-screen">
                        <img
                            src={BASE_URL + selectedImage}
                            alt="Selected"
                            className="w-full max-h-full object-contain"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Show all photos popup component
    let allpopup = null;
    if (showAllPhotos) {
        allpopup = (
            <div
                className="fixed inset-0 bg-black bg-opacity-50 w-full h-full flex items-center justify-center z-40"
                onClick={() => setShowAllPhotos(false)}
            >
                <div
                    className="relative p-8 rounded-lg bg-white max-w-5xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute top-4 right-4">
                        <button
                            onClick={() => setShowAllPhotos(false)}
                            className="flex gap-1 py-2 px-4 rounded-2xl shadow-sm shadow-gray-500 bg-white text-black"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="size-6"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            Close photos
                        </button>
                    </div>
                    <div className="overflow-auto max-h-[80vh] scrollbar">
                        {place?.photos?.length > 0 &&
                            place.photos.map((photo, index) => (
                                <div
                                    key={index}
                                    className="cursor-pointer mb-4"
                                    onClick={() => openImagePopup(photo.url)}
                                >
                                    <img
                                        src={BASE_URL + photo.url}
                                        alt=""
                                        className="max-w-[600px] max-h-[600px] object-cover rounded-lg shadow-md shadow-gray-300"
                                    />
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        );
    }

    // Return part preserved as requested
    return (
        <div className="relative">
            {popup}
            {allpopup}
            <div className="grid gap-2 grid-cols-2 rounded-3xl overflow-hidden">
                {place.photos?.[0] && (
                    <div
                        className="cursor-pointer col-span-2"
                        onClick={() => openImagePopup(place.photos[0].url)}
                    >
                        <img
                            src={BASE_URL + place.photos[0].url}
                            alt="Main"
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                {place.photos?.slice(1, 3).map((photo, index) => (
                    <div
                        key={index}
                        className="cursor-pointer"
                        onClick={() => openImagePopup(photo.url)}
                    >
                        <img
                            src={BASE_URL + photo.url}
                            alt={`Photo ${index}`}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ))}
            </div>
            <button
                onClick={() => setShowAllPhotos(true)}
                className="flex gap-1 absolute bottom-2 right-2 py-2 px-4 bg-white rounded-2xl shadow-sm shadow-gray-500"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-6"
                >
                    <path
                        fillRule="evenodd"
                        d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
                        clipRule="evenodd"
                    />
                </svg>
                Show more photos
            </button>
        </div>
    );
}

export default PlaceGallery;


